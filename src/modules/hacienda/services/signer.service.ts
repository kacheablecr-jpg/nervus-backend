import { Injectable, BadRequestException } from '@nestjs/common'
import * as forge from 'node-forge'
import * as crypto from 'crypto'
import { C14nCanonicalization, findAncestorNs } from 'xml-crypto'
import * as xpath from 'xpath'
import { create as xmlCreate } from 'xmlbuilder2'

const DS_NS = 'http://www.w3.org/2000/09/xmldsig#'
const XA_NS = 'http://uri.etsi.org/01903/v1.3.2#'
const C14N  = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
const ENV_SIG = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
const SHA256_URI = 'http://www.w3.org/2001/04/xmlenc#sha256'
const SP_TYPE = 'http://uri.etsi.org/01903#SignedProperties'

const POLICY_URI  = 'https://tribunet.hacienda.go.cr/docs/esquemas/2016/v4.1/Resolucion_Comprobantes_Electronicos_DGT-R-48-2016.pdf'
const POLICY_HASH = 'Wmzus0KlLTbA5s2j3n4g+MUTb4s0k4jjWZvqJlzPlhM='

function sha256b64(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('base64')
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function chunk76(b64: string): string {
  return b64.match(/.{1,76}/g)?.join('\n') ?? b64
}

function insertBeforeLastClose(xml: string, insertion: string): string {
  const idx = xml.lastIndexOf('</')
  if (idx === -1) throw new Error('XML sin etiqueta de cierre')
  return xml.slice(0, idx) + insertion + xml.slice(idx)
}

@Injectable()
export class SignerService {
  sign(xmlString: string, certB64: string, certPin: string): string {
    let p12Der: string
    try { p12Der = forge.util.decode64(certB64) }
    catch { throw new BadRequestException('Certificado inválido: no es base64 válido') }

    let p12: forge.pkcs12.Pkcs12Pfx
    try { p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Der), certPin) }
    catch { throw new BadRequestException('No se pudo abrir el certificado. Verifique el PIN.') }

    const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const keyBag   = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    const certBag  = certBags[forge.pki.oids.certBag]?.[0]

    if (!keyBag?.key || !certBag?.cert) {
      throw new BadRequestException('El certificado no contiene llave privada o certificado público')
    }

    const privKeyPem = forge.pki.privateKeyToPem(keyBag.key as forge.pki.PrivateKey)
    const certAsn1   = forge.pki.certificateToAsn1(certBag.cert)
    const certDerStr = forge.asn1.toDer(certAsn1).getBytes()
    const certDerBuf = Buffer.from(certDerStr, 'binary')
    const certBase64 = certDerBuf.toString('base64')
    const certDigest = sha256b64(certDerBuf)

    const issuerName = (certBag.cert.issuer.attributes as any[])
      .map((a: any) => `${a.shortName}=${a.value}`)
      .join(',')
    const serialHex    = certBag.cert.serialNumber as string
    const serialNumber = BigInt('0x' + (serialHex || '0')).toString()

    const sigId   = 'Signature'
    const spId    = 'SignedProperties'
    const sigTime = new Date().toISOString().slice(0, 19) + '-06:00'

    const spXml = this.buildSignedProperties(spId, sigTime, certDigest, issuerName, serialNumber)
    const c14n  = new C14nCanonicalization()

    const origDoc  = (xmlCreate(xmlString) as any).node as Document
    const origRoot = origDoc.documentElement
    const docC14n  = c14n.process(origRoot, { ancestorNamespaces: [] })
    const docDigest = sha256b64(Buffer.from(docC14n, 'utf-8'))

    const sigSkeleton = `<ds:Signature xmlns:ds="${DS_NS}" Id="${sigId}"><ds:Object><xades:QualifyingProperties xmlns:xades="${XA_NS}" Target="#${sigId}">${spXml}</xades:QualifyingProperties></ds:Object></ds:Signature>`
    const xmlWithSig  = insertBeforeLastClose(xmlString, sigSkeleton)
    const docWithSig  = (xmlCreate(xmlWithSig) as any).node as Document

    const spXpathExpr = `//*[@Id="${spId}"]`
    const spNodes     = xpath.select(spXpathExpr, docWithSig) as Node[]
    if (!spNodes.length) throw new BadRequestException('No se encontró xades:SignedProperties al firmar')
    const spAncestors = findAncestorNs(docWithSig, spXpathExpr)
    const spC14n      = c14n.process(spNodes[0] as any, { ancestorNamespaces: spAncestors })
    const spDigest    = sha256b64(Buffer.from(spC14n, 'utf-8'))

    const signedInfo = this.buildSignedInfo(sigId, spId, docDigest, spDigest)

    const SIGVAL_PLACEHOLDER = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

    const fullSig = [
      `<ds:Signature xmlns:ds="${DS_NS}" Id="${sigId}">`,
      signedInfo,
      `<ds:SignatureValue Id="${sigId}-SV">${SIGVAL_PLACEHOLDER}</ds:SignatureValue>`,
      `<ds:KeyInfo>`,
      `  <ds:X509Data>`,
      `    <ds:X509Certificate>${chunk76(certBase64)}</ds:X509Certificate>`,
      `  </ds:X509Data>`,
      `</ds:KeyInfo>`,
      `<ds:Object>`,
      `  <xades:QualifyingProperties xmlns:xades="${XA_NS}" Target="#${sigId}">`,
      spXml,
      `  </xades:QualifyingProperties>`,
      `</ds:Object>`,
      `</ds:Signature>`,
    ].join('')

    const xmlFull = insertBeforeLastClose(xmlString, fullSig)
    const docFull = (xmlCreate(xmlFull) as any).node as Document

    const siXpathExpr = `//*[local-name()="SignedInfo" and namespace-uri()="${DS_NS}"]`
    const siNodes     = xpath.select(siXpathExpr, docFull) as Node[]
    if (!siNodes.length) throw new BadRequestException('No se encontró ds:SignedInfo al firmar')
    const siAncestors = findAncestorNs(docFull, siXpathExpr)
    const siC14n      = c14n.process(siNodes[0] as any, { ancestorNamespaces: siAncestors })

    const sigValue = crypto.sign('sha256', Buffer.from(siC14n, 'utf-8'), {
      key: privKeyPem,
      padding: (crypto.constants as any).RSA_PKCS1_PADDING,
    }).toString('base64')

    return xmlFull.replace(SIGVAL_PLACEHOLDER, chunk76(sigValue))
  }

  private buildSignedProperties(spId: string, sigTime: string, certDigest: string, issuerName: string, serial: string): string {
    return [
      `<xades:SignedProperties xmlns:xades="${XA_NS}" xmlns:ds="${DS_NS}" Id="${spId}">`,
      `<xades:SignedSignatureProperties>`,
      `<xades:SigningTime>${sigTime}</xades:SigningTime>`,
      `<xades:SigningCertificate><xades:Cert>`,
      `<xades:CertDigest><ds:DigestMethod Algorithm="${SHA256_URI}"/><ds:DigestValue>${certDigest}</ds:DigestValue></xades:CertDigest>`,
      `<xades:IssuerSerial><ds:X509IssuerName>${escapeXml(issuerName)}</ds:X509IssuerName><ds:X509SerialNumber>${serial}</ds:X509SerialNumber></xades:IssuerSerial>`,
      `</xades:Cert></xades:SigningCertificate>`,
      `<xades:SignaturePolicyIdentifier><xades:SignaturePolicyId>`,
      `<xades:SigPolicyId><xades:Identifier Qualifier="OIDAsURI">${POLICY_URI}</xades:Identifier></xades:SigPolicyId>`,
      `<xades:SigPolicyHash><ds:DigestMethod Algorithm="${SHA256_URI}"/><ds:DigestValue>${POLICY_HASH}</ds:DigestValue></xades:SigPolicyHash>`,
      `</xades:SignaturePolicyId></xades:SignaturePolicyIdentifier>`,
      `</xades:SignedSignatureProperties>`,
      `</xades:SignedProperties>`,
    ].join('')
  }

  private buildSignedInfo(sigId: string, spId: string, docDigest: string, spDigest: string): string {
    return [
      `<ds:SignedInfo xmlns:ds="${DS_NS}">`,
      `<ds:CanonicalizationMethod Algorithm="${C14N}"/>`,
      `<ds:SignatureMethod Algorithm="${RSA_SHA256}"/>`,
      `<ds:Reference Id="${sigId}-ref0" URI=""><ds:Transforms>`,
      `<ds:Transform Algorithm="${ENV_SIG}"/><ds:Transform Algorithm="${C14N}"/>`,
      `</ds:Transforms><ds:DigestMethod Algorithm="${SHA256_URI}"/><ds:DigestValue>${docDigest}</ds:DigestValue></ds:Reference>`,
      `<ds:Reference Id="${sigId}-refsp" Type="${SP_TYPE}" URI="#${spId}"><ds:Transforms>`,
      `<ds:Transform Algorithm="${C14N}"/>`,
      `</ds:Transforms><ds:DigestMethod Algorithm="${SHA256_URI}"/><ds:DigestValue>${spDigest}</ds:DigestValue></ds:Reference>`,
      `</ds:SignedInfo>`,
    ].join('')
  }
}
