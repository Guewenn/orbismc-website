// Statut du serveur (joueurs en ligne) : ping « liste des serveurs » du protocole Minecraft, mis en cache 15 s.
const net = require('net');
const config = require('./config');

let cache = { a: 0, statut: { enLigne: false, joueurs: 0 } };
let enCours = null;
const HORS_LIGNE = { enLigne: false, joueurs: 0 };

function lireVarint(buf, offset = 0) {
  let valeur = 0;
  for (let n = 0; n < 5; n++) {
    if (offset + n >= buf.length) return null;
    const b = buf[offset + n];
    valeur |= (b & 0x7f) << (7 * n);
    if (!(b & 0x80)) return { valeur: valeur >>> 0, fin: offset + n + 1 };
  }
  throw new Error('VarInt invalide');
}

function varint(n) {
  const octets = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n !== 0) b |= 0x80;
    octets.push(b);
  } while (n !== 0);
  return Buffer.from(octets);
}

function paquet(...morceaux) {
  const corps = Buffer.concat(morceaux);
  return Buffer.concat([varint(corps.length), corps]);
}

function ping() {
  return new Promise((resoudre) => {
    const { hote, port } = config.minecraft;
    const s = net.createConnection({ host: hote, port }, () => {
      const h = Buffer.from(hote);
      const portB = Buffer.alloc(2);
      portB.writeUInt16BE(port);
      s.write(paquet(varint(0), varint(776), varint(h.length), h, portB, varint(1)));
      s.write(paquet(varint(0)));
    });
    let recu = Buffer.alloc(0);
    let termine = false;
    const fin = (statut) => {
      if (termine) return;
      termine = true;
      clearTimeout(delai);
      s.destroy();
      resoudre(statut);
    };
    const delai = setTimeout(() => fin(HORS_LIGNE), 3000);
    s.on('error', () => fin(HORS_LIGNE));
    s.on('end', () => fin(HORS_LIGNE));
    s.on('close', () => fin(HORS_LIGNE));
    s.on('data', (d) => {
      if (termine) return;
      if (recu.length + d.length > 1024 * 1024) return fin(HORS_LIGNE);
      recu = Buffer.concat([recu, d]);
      try {
        const taille = lireVarint(recu);
        if (!taille) return;
        if (taille.valeur > 1024 * 1024) return fin(HORS_LIGNE);
        if (recu.length < taille.fin + taille.valeur) return;
        const corps = recu.subarray(taille.fin, taille.fin + taille.valeur);
        const id = lireVarint(corps);
        if (!id || id.valeur !== 0) return fin(HORS_LIGNE);
        const texte = lireVarint(corps, id.fin);
        if (!texte || texte.fin + texte.valeur !== corps.length) return fin(HORS_LIGNE);
        const json = JSON.parse(corps.subarray(texte.fin).toString('utf8'));
        if (!Number.isSafeInteger(json.players?.online) || json.players.online < 0) return fin(HORS_LIGNE);
        fin({ enLigne: true, joueurs: json.players.online });
      } catch {
        fin(HORS_LIGNE);
      }
    });
  });
}

async function statut() {
  if (Date.now() - cache.a < 15000) return cache.statut;
  if (!enCours) {
    enCours = ping().then((resultat) => {
      cache = { a: Date.now(), statut: resultat };
      return resultat;
    }).finally(() => { enCours = null; });
  }
  return enCours;
}

module.exports = { statut };
