// Statut du serveur (joueurs en ligne) : ping « liste des serveurs » du protocole Minecraft, mis en cache 15 s.
const net = require('net');
const config = require('./config');

let cache = { a: 0, statut: { enLigne: false, joueurs: 0 } };

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
    const fin = (statut) => {
      s.destroy();
      resoudre(statut);
    };
    s.setTimeout(3000, () => fin({ enLigne: false, joueurs: 0 }));
    s.on('error', () => fin({ enLigne: false, joueurs: 0 }));
    s.on('data', (d) => {
      recu = Buffer.concat([recu, d]);
      const texte = recu.toString('utf8');
      const debut = texte.indexOf('{');
      if (debut < 0) return;
      try {
        const json = JSON.parse(texte.slice(debut));
        fin({ enLigne: true, joueurs: json.players?.online ?? 0 });
      } catch {
        // JSON incomplet : on attend la suite.
      }
    });
  });
}

async function statut() {
  if (Date.now() - cache.a < 15000) return cache.statut;
  cache = { a: Date.now(), statut: await ping() };
  return cache.statut;
}

module.exports = { statut };
