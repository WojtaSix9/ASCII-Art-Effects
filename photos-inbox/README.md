# Zdjęcia do strony (skrzynka odbiorcza)

Wrzuć tu zdjęcia (ok. 40), w dowolnych nazwach, na gałąź `etap2-animacje`
(GitHub: **Add file → Upload files**, folder `photos-inbox/`). Formaty: JPG, PNG, WebP.

Ten folder nie trafia na stronę. Po wrzuceniu Claude:

1. usunie duplikaty: identyczne pliki (ta sama suma SHA-256) zostaną raz,
   a podobne (np. to samo zdjęcie w innej rozdzielczości) wypisze do decyzji;
2. nada spójne nazwy: `photo-NN-temat.jpg`, np. `photo-03-portret.jpg`
   (NN = numer od 01 w kolejności wrzucenia, temat = 1–2 słowa po angielsku małymi literami, z myślnikami);
3. przygotuje wersje na stronę w `app/public/sample/` (dłuższy bok najwyżej 1600 px, JPG)
   i zapisze w `docs/` listę: stara nazwa → nowa nazwa;
4. dopiero na Twoją prośbę podmieni nimi zdjęcia na stronie.

Istniejące `photo-1.jpg` i `photo-2.jpg` dostaną nazwy w tym samym schemacie dopiero przy podmianie.
