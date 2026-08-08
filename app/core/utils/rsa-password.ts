import * as forge from 'node-forge'

const getPublicKey = () => {
  return (import.meta.env?.VITE_PASSWORD_RSA_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim()
}

export function encryptPassword(password: string): string {
  const publicKeyPem = getPublicKey()
  if (!publicKeyPem) {
    throw new Error('PASSWORD_RSA_PUBLIC_KEY_MISSING')
  }

  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem)
  const encrypted = publicKey.encrypt(password, 'RSA-OAEP', {
    md: forge.md.sha1.create(),
    mgf1: {
      md: forge.md.sha1.create(),
    },
  })

  return forge.util.encode64(encrypted)
}

export function encryptPasswordFields<T extends Record<string, any>>(
  data: T,
  fields: string[]
): T {
  const encryptedData: Record<string, any> = { ...data }
  for (const field of fields) {
    const value = encryptedData[field]
    if (typeof value === 'string' && value !== '') {
      encryptedData[field] = encryptPassword(value)
    }
  }
  return encryptedData as T
}
