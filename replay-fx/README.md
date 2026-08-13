# Replay FX

Application autonome de backtesting manuel Forex sur données historiques réelles.

## Ouvrir l’application

Ouvrez `index.html` dans un navigateur récent. Aucun compte, serveur ou installation n’est nécessaire. Les trades, notes, statistiques et captures restent stockés localement dans le navigateur utilisé.

## Données intégrées

- EUR/USD, GBP/USD, USD/JPY, USD/CHF, USD/CAD, AUD/USD et NZD/USD ;
- unités 1 min, 5 min, 15 min, 30 min, 1 h, 4 h et journalier ;
- bougies Bid HistData.com de 2024, issues des fichiers une minute puis agrégées pour les unités supérieures ;
- historique cinq minutes couvrant toute l’année et servant de base commune aux vues 5 min à journalier, afin de conserver exactement la même date en analyse multi-time-frame ;
- timestamps source en EST fixe (UTC−5), convertis en UTC puis affichés dans le fuseau du navigateur.

L’import CSV accepte aussi les colonnes `date`, `open`, `high`, `low`, `close`, ainsi que le format HistData `YYYYMMDD HHMMSS;OPEN;HIGH;LOW;CLOSE`.

## Fonctionnalités principales

- replay bougie par bougie ou automatique, vitesse réglable, retour arrière hors position ;
- changement d’unité de temps non destructif : instant de marché, position, niveaux et tracés conservés ;
- futur toujours masqué, zoom, déplacement, plein écran et captures ;
- marge flottante à droite du prix et outils de tracé : tendance, rectangle et Fibonacci ;
- indicateur RSI 14 activable sous le graphique ;
- positions achat/vente avec entrée, stop et objectif déplaçables ;
- risque en pourcentage ou en euros, taille estimée et ratio risque/rendement ;
- sorties SL, TP, break-even ou manuelles, avec R, pips, MFE, MAE et durée ;
- journal illustré, statistiques en direct, progression jusqu’au prestige ;
- exports CSV, Excel `.xlsx` et PDF.

Les résultats sont des simulations éducatives. Ils n’intègrent pas automatiquement spread, commission, swap ou slippage.
