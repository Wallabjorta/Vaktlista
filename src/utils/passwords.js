const PBKDF2_ITERATIONS = 100000;

const textEncoder = new TextEncoder();

const toHex = (buffer) => {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export const hashPassword = async (password, saltHex) => {
  const salt = saltHex
    ? new Uint8Array(saltHex.match(/.{2}/g).map(byte => parseInt(byte, 16)))
    : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return {
    salt: toHex(salt),
    hash: toHex(derivedBits)
  };
};

export const verifyPassword = async (password, storedSalt, storedHash) => {
  if (!storedSalt || !storedHash) return false;
  const { hash } = await hashPassword(password, storedSalt);
  return hash === storedHash;
};
