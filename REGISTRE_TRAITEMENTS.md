# Registre des traitements — PropDesk

Registre des activités de traitement au sens de l'**Article 30 du RGPD**.
Document interne, à conserver et tenir à jour (pas nécessaire de le publier).
Modèle structuré à partir du schéma réel de l'application (`server/db.ts`) —
voir la note en bas de page pour la méthode. Les champs marqués
**[À COMPLÉTER]** demandent une information que seul toi peux fournir
(décision d'entreprise, contact, éventuel sous-traitant formalisé).

---

## 0. Responsable de traitement

| Champ | Valeur |
|---|---|
| Nom | Thomas Gauthey |
| Statut | Entrepreneur individuel (micro-entreprise) |
| SIRET | [À COMPLÉTER — en cours d'attribution, voir `LegalNoticeModal.tsx`] |
| Contact | th.gauthey99@gmail.com |
| DPO (délégué à la protection des données) | [À COMPLÉTER — facultatif pour une micro-entreprise sans traitement à grande échelle, mais note-le "Non applicable" explicitement plutôt que de laisser vide] |

---

## 1. Gestion des comptes et de l'accès

| Champ | Détail |
|---|---|
| **Finalité** | Créer, authentifier et sécuriser les comptes des utilisateurs de la plateforme (élèves et staff/coachs). |
| **Base légale** | Exécution du contrat (accès au service souscrit) pour les élèves ; intérêt légitime (gestion d'équipe) pour le staff. |
| **Personnes concernées** | Élèves inscrits à l'accompagnement ; comptes staff (coach fondateur + coachs invités). |
| **Données traitées** | Email, mot de passe (haché, jamais en clair — scrypt, paramètres OWASP), nom, photo de profil, numéro de téléphone (staff), statut administrateur. Pour la 2FA (staff, optionnelle) : secret TOTP, codes de récupération (hachés). |
| **Destinataires** | Le responsable de traitement lui-même et son équipe staff (accès en lecture aux fiches élèves dans le cadre du suivi pédagogique). Aucun tiers. |
| **Durée de conservation** | Comptes actifs : tant que le compte existe. Sessions de connexion : 30 jours glissants (`sessions`/`student_sessions`, `server/auth/sessions.ts`). Liens de réinitialisation de mot de passe : 1h, usage unique. La suppression de la fiche élève efface désormais en cascade l'identifiant de connexion ET toutes les données associées (voir §6, point 1) ; la simple révocation d'accès, elle, conserve volontairement la fiche et l'historique. |
| **Hébergement / lieu** | Railway, région Amsterdam (UE) — base SQLite sur volume persistant. Pas de transfert hors UE identifié. |
| **Mesures de sécurité** | Hachage scrypt (N=2¹⁷, coût OWASP), verrouillage de compte après 5 échecs/15 min, rate-limiting IP, cookies de session `httpOnly`/`secure`/`sameSite`, 2FA TOTP optionnelle pour le staff. |

---

## 2. Suivi pédagogique et accompagnement trading

| Champ | Détail |
|---|---|
| **Finalité** | Cœur du service : permettre à l'élève de journaliser ses trades, suivre sa progression, et au coach de l'accompagner sur cette base. |
| **Base légale** | Exécution du contrat (c'est l'objet même de la prestation d'accompagnement). |
| **Personnes concernées** | Élèves. |
| **Données traitées** | Historique de trades (paire, direction, PnL, stratégie, notes, captures d'écran éventuelles), portefeuilles/comptes de trading déclarés (capital, type de compte), plan de trading personnel, setups/stratégies définis, progression aux modules vidéo et résultats de quiz, badges obtenus. **Aucune donnée financière réelle** (pas de connexion à un compte de courtage, pas de moyen de paiement) — ce sont des données déclaratives saisies par l'élève lui-même. |
| **Destinataires** | L'élève lui-même, et le staff dans le cadre du suivi (Vue Complète en lecture seule pour le plan de trading et les setups — voir HANDOFF.md). |
| **Durée de conservation** | Tant que le compte élève est actif. **À la résiliation (suppression de la fiche par le staff) : suppression immédiate et complète**, aucune conservation différée — décision explicite de l'utilisateur, mise en œuvre via l'effacement en cascade (voir §6, point 1). |
| **Destinataires hors UE** | Aucun. |
| **Mesures de sécurité** | Cloisonnement strict par compte (chaque élève n'accède qu'à ses propres données), séparation des bureaux de données (`user_id`), aucune donnée élève visible d'un autre élève. |

---

## 3. Messagerie coach – élève

| Champ | Détail |
|---|---|
| **Finalité** | Échange entre l'élève et son coach dans le cadre de l'accompagnement. |
| **Base légale** | Exécution du contrat. |
| **Personnes concernées** | Élèves et staff. |
| **Données traitées** | Contenu des messages, horodatage, statut de lecture. |
| **Destinataires** | Les deux parties de la conversation uniquement. |
| **Durée de conservation** | Tant que le compte élève est actif. Suppression immédiate à la résiliation, même politique que §2 — les messages sont stockés dans le bureau personnel de l'élève, donc couverts par le même effacement en cascade. |
| **Mesures de sécurité** | Filtrage par identifiant de conversation, aucun accès croisé entre élèves. |

---

## 4. Sécurité informatique (journal de sécurité)

| Champ | Détail |
|---|---|
| **Finalité** | Détecter et tracer les tentatives d'intrusion, échecs de connexion, verrouillages de compte — sécurité du système d'information. |
| **Base légale** | Intérêt légitime (sécurité des systèmes, obligation implicite de moyens de sécurité au titre de l'Article 32 RGPD). |
| **Personnes concernées** | Toute personne tentant de se connecter (élève ou staff), y compris les tentatives échouées sur un email inexistant. |
| **Données traitées** | Adresse IP, email (tentative), horodatage, type d'événement (connexion réussie/échouée, verrouillage, changement de mot de passe...), sévérité. |
| **Destinataires** | Le compte fondateur uniquement (`requireOwner` — journal de sécurité réservé, voir `server/auth/securityEvents.ts`). |
| **Durée de conservation** | **90 jours maximum**, purge automatique déjà en place (`purgeOldSecurityEvents`, `server/auth/securityEvents.ts`) — conforme à la recommandation CNIL sur les durées de conservation des logs de sécurité (6 mois à 1 an maximum ; 90 jours est **plus strict** que le maximum recommandé). |
| **Mesures de sécurité** | Accès restreint au seul fondateur, purge automatique, pas d'export possible en dehors de la consultation dans l'app. |

---

## 5. Exercice des droits RGPD (export de données)

| Champ | Détail |
|---|---|
| **Finalité** | Permettre à l'élève d'exercer son droit à la portabilité (Article 20). |
| **Base légale** | Obligation légale (RGPD). |
| **Personnes concernées** | Élèves qui déclenchent l'export. |
| **Données traitées** | Copie du profil, plan de trading, progression modules, badges obtenus — voir `server/auth/exportData.ts`. Générée à la demande, non stockée côté serveur (téléchargement direct, aucune trace conservée de l'export lui-même). |
| **Destinataires** | L'élève lui-même exclusivement. |
| **Durée de conservation** | Sans objet — rien n'est conservé côté serveur après l'export. |
| **Mesures de sécurité** | Authentification requise (`requireStudentKind`), chaque élève ne peut exporter que ses propres données. |

---

## 6. Points de vigilance identifiés (à traiter ou documenter)

Ces points ne sont pas des cases du registre lui-même, mais des constats faits
en le rédigeant, à trancher :

1. ✅ **Droit à l'effacement (Article 17) — corrigé.** Bouton "Supprimer
   l'élève" côté staff (suppression de la fiche, `StudentTracking.tsx`) :
   supprime désormais en cascade, dans une seule transaction, la fiche, le
   compte de connexion élève, ET son bureau personnel entier (trades,
   comptes de trading, plan de trading, setups, progression modules,
   badges, notifications, résultats de quiz, messages) — voir
   `replaceCollection` dans `server/repositories.ts`. Vérifié par un test
   direct sur la base (fiche + toutes les données associées confirmées
   supprimées après l'action). **Distinct de "Révoquer l'accès"** (le
   toggle "Compte actif") : celui-ci désactive seulement la connexion et
   garde la fiche + l'historique pour le suivi du coach — comportement
   volontairement différent, l'effacement complet passe uniquement par la
   suppression de la fiche.
2. ✅ **Durée de conservation après résiliation — tranchée.** Décision
   explicite de l'utilisateur : suppression immédiate et complète à la
   résiliation (suppression de la fiche), pas de délai de rétention
   différé. Techniquement déjà en place (point 1 ci-dessus).
3. **Sous-traitant technique (Railway)** : hébergeur en UE (Amsterdam), mais
   pas de DPA (Data Processing Agreement) formellement identifié dans ce
   dépôt. Railway propose un DPA standard sur demande — à vérifier/signer
   si pas déjà fait.

---

*Document généré à partir d'une lecture du schéma réel de l'application
(`server/db.ts`, `server/auth/*.ts`) le 20 août 2026. Les champs
**[À COMPLÉTER]** sont volontairement laissés à ta décision — un registre
rempli avec des suppositions serait moins utile qu'un registre honnête sur
ce qui reste à trancher.*
