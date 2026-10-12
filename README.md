# Jumeau numérique d'un circuit de broyage de phosphate

**Preuve de concept d'un jumeau numérique pour la supervision intelligente d'un circuit de broyage de phosphate**
Projet de fin d'année réalisé par **Zineb El Ouardi** (ENSEM Casablanca, filière Digitalisation des Processus Industriels), en stage au département Digital Engineering de JESA (juillet – août 2026).

Le jumeau numérique surveille en temps réel un circuit fermé de broyage (bac de pompage, pompe à pulpe, batterie d'hydrocyclones, broyeur à boulets). Il répond à quatre questions :

- **Y a-t-il un défaut ?** Lequel, sur quelle machine, et que faire ?
- **Quand faudra-t-il intervenir ?** Pronostic de la durée de vie résiduelle des équipements.
- **Que s'est-il passé ?** Historique complet et persistant de toutes les mesures.
- **Comment les équipements sont-ils liés ?** Graphe de connaissances et copilote conversationnel.

> Les données utilisées sont simulées (un mois de fonctionnement, juillet 2026). Aucune donnée réelle d'exploitation n'est publiée dans ce dépôt.

## Architecture

```
KEPServerEX (OPC UA) ─► Node-RED ─┐
                                  ├─► Mosquitto (MQTT) ─► Backend FastAPI ─► Application React
Relecture des historiques (CSV) ──┘                          │
                                              Historien SQLite · Graphe Neo4j
```

| Couche | Technologies |
|---|---|
| Acquisition | KEPServerEX (automate simulé, 45 signaux), Node-RED |
| Transport | Eclipse Mosquitto (MQTT) |
| Traitement | Python, FastAPI (domaines : telemetry, simulation, assets, faults, prognosis, knowledge_graph, auth) |
| Stockage | Historien SQLite, Neo4j (graphe en mémoire en secours), fichiers CSV |
| Analyse | Règles de détection des défauts, modèle de dégradation, copilote Graph RAG |
| Interface | React 19, Vite, React Three Fiber (3D), vis-network, Recharts |
| Déploiement | Docker Compose (5 services) |

## Fonctionnalités

- **Détection et diagnostic des défauts** : 10 règles « SI … ALORS … » (vibrations selon ISO 10816-3, températures de paliers, cavitation de la pompe, surcharge du broyeur, apex usés ou bouchés, cyclone hors service). Chaque alarme indique l'équipement, la mesure en cause, la source du seuil et l'action conseillée. La médiane des 10 dernières minutes et une hystérésis évitent les fausses alarmes (ISA-18.2).
- **Injection de défauts** pour la démonstration : 9 défauts réalistes, détectés en direct sur le synoptique (halo orange ou rouge autour de l'équipement).
- **Pronostic de maintenance** : détection des interventions dans les signaux, rapprochement avec la GMAO et date prévue de la prochaine intervention.
- **Synoptique animé, vue 3D et fiches équipements** en temps réel.
- **Graphe de connaissances** (69 nœuds, 129 relations) et **copilote Graph RAG** (Gemini, avec un moteur local de secours).
- **Historien persistant** : aucune mesure n'est perdue à l'arrêt du poste.
- **Authentification** JWT avec trois rôles.

## Résultats

| Évaluation | Résultat |
|---|---|
| Mois de fonctionnement normal (43 200 minutes) | **0 fausse alarme** ; seuls les 2 événements réels sont signalés |
| Défauts injectés (9 types × 300 instants) | **100 %** de bons diagnostics, aucune confusion entre défauts |
| Pronostic (5 cycles, 1 543 prévisions) | erreur moyenne de **2,4 h**, trois jours avant l'intervention |

Scripts d'évaluation : `ml/detection_defauts/evaluer_detection.py` et `ml/maintenance_predictive/pronostic.py`.

## Lancer la démonstration

Prérequis : Docker Desktop (et Node-RED pour la chaîne OPC UA, facultatif).

```bash
docker compose up -d
```

Sous Windows, un double-clic sur `demarrer_demo.bat` démarre tout et ouvre le site ; `arreter_demo.bat` arrête proprement les services.

- Application : http://localhost:5173 (compte de démonstration : `engineer` / `engineer123`)
- API (documentation) : http://localhost:8000/docs
- Node-RED : http://localhost:1880

## Structure du dépôt

```
backend/          API FastAPI (domaines métier, règles de défauts, pronostic, historien)
frontend/         Application React
data/             Données simulées du circuit (procédé, santé, GMAO, registre des signaux)
infrastructure/   Configuration Mosquitto, projet KEPServerEX, flux Node-RED
ml/               Évaluation de la détection des défauts et du pronostic
rapport/          Rapport du projet (LaTeX et PDF)
```

## Auteure

**Zineb El Ouardi** — élève ingénieure, ENSEM Casablanca.
Encadrant industriel : M. Abdelkader Es-Sallami (JESA).
