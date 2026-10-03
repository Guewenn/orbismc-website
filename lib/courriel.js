const https = require('https');
const { esc } = require('./html');

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // Sera chargé dès que nodemailer est installé
}

const config = require('./config');

const DESTINATAIRE = (config.courriel && config.courriel.destinataire) || process.env.EMAIL_DESTINATAIRE || process.env.CONTACT_EMAIL || 'contact.orbis.server@gmail.com';

/**
 * Envoie un email via l'API Resend (utilise le module https natif sans dépendance externe).
 */
function envoyerViaResend({ cle, de, a, repondreA, sujet, html, texte }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      from: de || 'OrbisMC <onboarding@resend.dev>',
      to: [a],
      reply_to: repondreA,
      subject: sujet,
      html: html,
      text: texte,
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cle}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ id: data });
        } else {
          reject(new Error(`Resend API erreur ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Délai d\'attente dépassé (timeout) lors de l\'appel à Resend'));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Envoie une notification sur Discord via un webhook (si configuré).
 */
function envoyerNotificationDiscord({ url, pseudo, email, sujet, message, dateStr }) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const payload = JSON.stringify({
        username: 'OrbisMC Contact',
        avatar_url: 'https://mcorbis.com/img/favicon.png',
        embeds: [
          {
            title: `📬 Nouveau message : ${sujet}`,
            color: 0x5b47e0,
            fields: [
              { name: 'Pseudo', value: pseudo || 'Non renseigné', inline: true },
              { name: 'Email', value: email, inline: true },
              { name: 'Date', value: dateStr, inline: false },
              { name: 'Message', value: message.length > 1000 ? message.slice(0, 997) + '...' : message, inline: false },
            ],
            footer: { text: 'Site Web OrbisMC' },
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 8000,
      };

      const req = https.request(options, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout Discord webhook'));
      });

      req.write(payload);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Envoie un message de contact à l'adresse officielle contact.orbis.server@gmail.com
 *
 * @param {Object} params
 * @param {string} params.pseudo
 * @param {string} params.email
 * @param {string} params.sujet
 * @param {string} params.message
 * @param {string} [params.ip]
 * @returns {Promise<{ succes: boolean, methode?: string, erreur?: string }>}
 */
async function envoyerContact({ pseudo, email, sujet, message, ip }) {
  const dateStr = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const sujetComplet = `[Contact OrbisMC] ${sujet} - ${pseudo || 'Joueur'}`;

  const texte = `Nouveau message de contact reçu sur OrbisMC\n`
    + `=================================================\n\n`
    + `• Date : ${dateStr}\n`
    + `• Pseudo : ${pseudo || 'Non renseigné'}\n`
    + `• Email de contact : ${email}\n`
    + `• Sujet : ${sujet}\n`
    + `• IP : ${ip || 'Inconnue'}\n\n`
    + `Message :\n`
    + `-------------------------------------------------\n`
    + `${message}\n`
    + `-------------------------------------------------\n\n`
    + `Astuce : Clique sur « Répondre » pour envoyer directement un email à ${email}.`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 20px; background-color: #0c0a14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #151221; border: 1px solid #2d2645; border-radius: 12px; overflow: hidden; color: #f0f0f5;">
        <div style="background: linear-gradient(135deg, #5b47e0, #805ad5); padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">OrbisMC — Nouveau Message</h1>
          <p style="margin: 6px 0 0 0; color: #e9d8fd; font-size: 14px;">Formulaire de contact du site</p>
        </div>
        <div style="padding: 24px;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <tr>
              <td style="padding: 8px 12px; color: #a0aec0; width: 130px; border-bottom: 1px solid #231f36;"><b>Sujet :</b></td>
              <td style="padding: 8px 12px; color: #ffffff; font-weight: 600; border-bottom: 1px solid #231f36;">${esc(sujet)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; color: #a0aec0; border-bottom: 1px solid #231f36;"><b>Pseudo :</b></td>
              <td style="padding: 8px 12px; color: #ffffff; border-bottom: 1px solid #231f36;">${esc(pseudo || 'Non renseigné')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; color: #a0aec0; border-bottom: 1px solid #231f36;"><b>Email :</b></td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #231f36;"><a href="mailto:${esc(email)}" style="color: #9f7aea; text-decoration: underline;">${esc(email)}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; color: #a0aec0; border-bottom: 1px solid #231f36;"><b>Reçu le :</b></td>
              <td style="padding: 8px 12px; color: #cbd5e0; border-bottom: 1px solid #231f36;">${dateStr}</td>
            </tr>
          </table>

          <div style="margin-top: 20px;">
            <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; text-transform: uppercase; color: #a0aec0; letter-spacing: 0.5px;">Message du joueur :</p>
            <div style="background-color: #1a162b; border-left: 4px solid #5b47e0; border-radius: 6px; padding: 16px; font-size: 15px; line-height: 1.6; color: #ffffff; white-space: pre-wrap;">${esc(message)}</div>
          </div>
        </div>
        <div style="background-color: #100d1c; padding: 16px; text-align: center; border-top: 1px solid #231f36; font-size: 13px; color: #718096;">
          Réponds directement à cet email pour recontacter <b>${esc(email)}</b>.
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Notification Discord en tâche de fond (si webhook configuré)
  if (process.env.DISCORD_WEBHOOK_URL) {
    envoyerNotificationDiscord({
      url: process.env.DISCORD_WEBHOOK_URL,
      pseudo,
      email,
      sujet,
      message,
      dateStr,
    }).catch((err) => console.error('[COURRIEL] Discord webhook non transmis :', err.message));
  }

  // 2. Tentative via SMTP / Gmail (Nodemailer)
  const passSmtp = (config.courriel && config.courriel.smtp && config.courriel.smtp.motDePasse) || process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const userSmtp = (config.courriel && config.courriel.smtp && config.courriel.smtp.utilisateur) || process.env.SMTP_USER || process.env.GMAIL_USER || 'contact.orbis.server@gmail.com';
  const hostSmtp = (config.courriel && config.courriel.smtp && config.courriel.smtp.hote) || process.env.SMTP_HOST || 'smtp.gmail.com';
  const portSmtp = (config.courriel && config.courriel.smtp && config.courriel.smtp.port) || parseInt(process.env.SMTP_PORT || '465', 10);
  const secureSmtp = portSmtp === 465 || process.env.SMTP_SECURE === 'true';

  if (passSmtp) {
    if (!nodemailer) {
      try {
        nodemailer = require('nodemailer');
      } catch (e) {
        console.error('[COURRIEL] Le module nodemailer n\'est pas disponible :', e.message);
      }
    }

    if (nodemailer) {
      try {
        const passNettoye = String(passSmtp).trim().replace(/\s+/g, '');
        const transportConfig = hostSmtp.includes('gmail.com')
          ? {
              service: 'gmail',
              auth: {
                user: userSmtp,
                pass: passNettoye,
              },
            }
          : {
              host: hostSmtp,
              port: portSmtp,
              secure: secureSmtp,
              auth: {
                user: userSmtp,
                pass: passNettoye,
              },
            };

        const transporteur = nodemailer.createTransport(transportConfig);

        await transporteur.sendMail({
          from: `"OrbisMC Support" <${userSmtp}>`,
          to: DESTINATAIRE,
          replyTo: email,
          subject: sujetComplet,
          text: texte,
          html: html,
        });

        console.log(`[COURRIEL] Message envoyé avec succès via SMTP (${hostSmtp}) à ${DESTINATAIRE}`);
        return { succes: true, methode: 'smtp' };
      } catch (err) {
        console.error('[COURRIEL] Erreur lors de l\'envoi via SMTP :', err.message);
      }
    }
  }

  // 3. Tentative via Resend API (HTTP direct)
  if (process.env.RESEND_API_KEY) {
    try {
      await envoyerViaResend({
        cle: process.env.RESEND_API_KEY,
        de: process.env.RESEND_FROM || 'OrbisMC Support <onboarding@resend.dev>',
        a: DESTINATAIRE,
        repondreA: email,
        sujet: sujetComplet,
        html,
        texte,
      });

      console.log(`[COURRIEL] Message envoyé avec succès via Resend à ${DESTINATAIRE}`);
      return { succes: true, methode: 'resend' };
    } catch (err) {
      console.error('[COURRIEL] Erreur lors de l\'envoi via Resend :', err.message);
    }
  }

  // Si aucun moyen d'envoi n'a fonctionné ou n'est configuré
  console.warn('[COURRIEL] Aucun fournisseur de messagerie opérationnel. Définissez GMAIL_APP_PASSWORD ou RESEND_API_KEY dans vos variables Vercel.');

  if (process.env.DISCORD_WEBHOOK_URL) {
    return { succes: true, methode: 'discord_fallback' };
  }

  return {
    succes: false,
    erreur: "Le service d'envoi d'email nécessite une configuration (GMAIL_APP_PASSWORD ou RESEND_API_KEY). Veuillez contacter directement contact.orbis.server@gmail.com.",
  };
}

function securiteDisponible() {
  return !!((process.env.RESEND_API_KEY && process.env.RESEND_FROM) || config.courriel.smtp.motDePasse);
}

// Les codes de sécurité vont uniquement à l'adresse concernée, sans copie Discord ni journal du lien.
async function envoyerSecurite({ email, sujet, texte }) {
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    return envoyerViaResend({ cle: process.env.RESEND_API_KEY, de: process.env.RESEND_FROM, a: email, sujet, texte });
  }
  const smtp = config.courriel.smtp;
  if (!smtp.motDePasse) throw new Error('Service mail indisponible');
  const transporteur = require('nodemailer').createTransport({
    host: smtp.hote, port: smtp.port, secure: smtp.port === 465,
    auth: { user: smtp.utilisateur, pass: smtp.motDePasse },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
  });
  try { await transporteur.sendMail({ from: `OrbisMC <${smtp.utilisateur}>`, to: email, subject: sujet, text: texte }); }
  finally { transporteur.close(); }
}

module.exports = {
  securiteDisponible,
  envoyerSecurite,
  envoyerContact,
  DESTINATAIRE,
};
