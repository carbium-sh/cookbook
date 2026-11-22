// A certificate for services.carbium.sh, made once per test run with openssl in a temporary folder: a throwaway
// authority and a leaf it signs. Compiled examples trust it through SSL_CERT_FILE and reach the stand-in through a
// hosts entry for services.carbium.sh on 127.0.0.1, both set on the test side only. The authority's key is deleted once
// the leaf is signed, and the folder when the process exits.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let made

export function certificate() {
  if (made) return made
  const dir = mkdtempSync(join(tmpdir(), 'cookbook-tls-'))
  process.once('exit', () => rmSync(dir, { recursive: true, force: true }))
  const at = (name) => join(dir, name)
  const openssl = (...args) => execFileSync('openssl', args, { stdio: 'ignore' })
  const ec = ['-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes']
  openssl('req', '-x509', ...ec, '-days', '2', '-subj', '/CN=cookbook test authority', '-keyout', at('ca-key.pem'), '-out', at('ca.pem'))
  openssl('req', ...ec, '-subj', '/CN=services.carbium.sh', '-keyout', at('leaf-key.pem'), '-out', at('leaf.csr'))
  writeFileSync(at('leaf.ext'), 'subjectAltName=DNS:services.carbium.sh\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n')
  openssl('x509', '-req', '-in', at('leaf.csr'), '-CA', at('ca.pem'), '-CAkey', at('ca-key.pem'), '-CAcreateserial', '-days', '2', '-extfile', at('leaf.ext'), '-out', at('leaf.pem'))
  rmSync(at('ca-key.pem'))
  made = { key: readFileSync(at('leaf-key.pem')), cert: readFileSync(at('leaf.pem')), caFile: at('ca.pem') }
  return made
}
