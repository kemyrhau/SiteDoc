-- PSI-mal for testprosjektet
INSERT INTO report_templates (id, project_id, name, description, prefix, category, domain, show_subject, show_enterprise, show_location, show_priority, version, created_at, updated_at)
VALUES (
  'psi-mal-001',
  '2bd15f09-8fbc-4de9-a826-3d2e5462bb23',
  'PSI — Sikkerhetsinstruks',
  'Prosjektspesifikk sikkerhetsinstruks for byggeplassen',
  'PSI',
  'sjekkliste',
  'hms',
  false, false, false, false,
  1, NOW(), NOW()
);

-- Seksjon 1: Velkommen
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-010', 'psi-mal-001', 'heading', 'Velkommen til byggeplassen', '{}', 10, false, NOW());
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-011', 'psi-mal-001', 'info_text', 'Introduksjon', '{"content": "Denne sikkerhetsinstruksen gjelder for alle som skal utfore arbeid pa dette prosjektet. Les noye gjennom alle seksjoner. Du ma besvare kontrollsporsmal og signere for du kan starte arbeid.\n\nAlle arbeidere, besokende og underleverandorer er pliktige til a folge reglene i denne instruksen. Brudd pa sikkerhetsreglene kan fore til bortvisning fra byggeplassen."}', 11, false, NOW());
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-012', 'psi-mal-001', 'info_text', 'Nokkelpersoner', '{"content": "Prosjektleder: Kenneth Myrhaug\nHMS-ansvarlig: Kenneth Myrhaug\nTelefon HMS: +47 123 45 678\n\nNodnummer:\n- Brann: 110\n- Politi: 112\n- Ambulanse: 113\n- Nermeste legevakt: Storgata Legevakt, Storgata 40"}', 12, false, NOW());

-- Seksjon 2: Verneutstyr
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-020', 'psi-mal-001', 'heading', 'Verneutstyr', '{}', 20, false, NOW());
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-021', 'psi-mal-001', 'info_text', 'Pakrevd verneutstyr', '{"content": "Folgende verneutstyr er ALLTID pakrevd pa byggeplassen:\n\n- Hjelm (CE-merket, max 5 ar gammel)\n- Vernesko med staltupp (S3)\n- Refleksvest (klasse 2 eller hoyere)\n- Vernebriller\n\nVed spesifikke arbeidsoperasjoner:\n- Horselsvern ved stoyende arbeid (over 80 dB)\n- Fallsikring ved arbeid i hoyden (over 2 meter)\n- Andedrettsvern ved sveising, sliping eller stovete arbeid\n- Hansker tilpasset arbeidsoperasjonen"}', 21, false, NOW());

-- Seksjon 3: Nodprosedyrer
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-030', 'psi-mal-001', 'heading', 'Nodprosedyrer og evakuering', '{}', 30, false, NOW());
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-031', 'psi-mal-001', 'info_text', 'Evakuering', '{"content": "Ved brannalarm eller evakueringssignal:\n\n1. Stopp alt arbeid umiddelbart\n2. Sla av maskiner og utstyr hvis det kan gjores trygt\n3. Ga til nermeste nodutgang (merket med gronne skilt)\n4. Mot opp pa MOTEPLASS ved hovedporten\n5. Meld deg til din arbeidsleder\n6. Vent pa beskjed fra HMS-ansvarlig\n\nBrannslukningsapparat finnes ved:\n- Hovedinngang\n- Hver etasje ved trappeoppgang\n- Brakkeriggen\n\nForstehjelp:\n- Førstehjelpskoffert i brakkeriggen og pa hver etasje\n- Hjertestarter (AED) ved hovedinngang"}', 31, false, NOW());

-- Seksjon 4: Sikkerhetsregler
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-040', 'psi-mal-001', 'heading', 'Generelle sikkerhetsregler', '{}', 40, false, NOW());
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-041', 'psi-mal-001', 'info_text', 'Regler', '{"content": "1. RUSMIDDELPOLITIKK: Null-toleranse for alkohol og narkotika. Brudd forer til umiddelbar bortvisning.\n\n2. RYDDIGHET: Hold arbeidsomradet ryddig. Avfall sorteres i merkede kontainere.\n\n3. ARBEIDSTID: Ordiner arbeidstid er 07:00-15:30. Arbeid utenom dette krever godkjenning.\n\n4. FERDSEL: Bruk kun godkjente gangveier. Hold avstand til kraner og lofteoperasjoner. Fartsgrense 20 km/t.\n\n5. ARBEID I HOYDEN: Alt arbeid over 2 meter krever fallsikring. Stillas skal vere godkjent og kontrollert.\n\n6. VARME ARBEIDER: Sveising, sliping og skjering krever varme-arbeider-tillatelse.\n\n7. GRAVING: Alt gravearbeid skal ha gravemelding og pavist kabler/ror.\n\n8. AVVIK: Alle uonskede hendelser, nestenulykker og farlige forhold SKAL rapporteres."}', 41, false, NOW());

-- Seksjon 5: Kontrollsporsmal
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-050', 'psi-mal-001', 'heading', 'Kontrollsporsmal', '{}', 50, false, NOW());
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-051', 'psi-mal-001', 'info_text', 'Instruksjon', '{"content": "Besvar folgende sporsmal for a bekrefte at du har forstatt sikkerhetsinstruksen. Alle sporsmal ma besvares riktig."}', 51, false, NOW());
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-052', 'psi-mal-001', 'quiz', 'Nodnummer brann', '{"question": "Hva er nodnummeret for brann?", "options": ["110", "112", "113", "911"], "correctIndex": 0}', 52, true, NOW());
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-053', 'psi-mal-001', 'quiz', 'Verneutstyr', '{"question": "Hvilket av disse er ALLTID pakrevd pa byggeplassen?", "options": ["Horselsvern", "Fallsikring", "Refleksvest", "Andedrettsvern"], "correctIndex": 2}', 53, true, NOW());
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-054', 'psi-mal-001', 'quiz', 'Evakuering', '{"question": "Hvor er moteplassen ved evakuering?", "options": ["I brakkeriggen", "Ved nermeste nodutgang", "Ved hovedporten", "Pa parkeringsplassen"], "correctIndex": 2}', 54, true, NOW());

-- Seksjon 6: Signatur
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-060', 'psi-mal-001', 'heading', 'Signatur', '{}', 60, false, NOW());
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-061', 'psi-mal-001', 'info_text', 'Bekreftelse', '{"content": "Ved a signere bekrefter jeg at jeg har lest, forstatt og vil folge sikkerhetsinstruksen for dette prosjektet. Jeg er kjent med nodprosedyrer, verneutstyrskrav og generelle sikkerhetsregler."}', 61, false, NOW());
INSERT INTO report_objects (id, template_id, type, label, config, sort_order, required, updated_at) VALUES
('psi-obj-062', 'psi-mal-001', 'signature', 'Signatur', '{}', 62, true, NOW());
