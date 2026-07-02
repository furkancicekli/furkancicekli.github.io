CREATE TABLE gallery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
-- Mevcut atölye fotoğrafları (Faz 1'de R2'ya yüklendi) devralınır:
INSERT INTO gallery_items (r2_key, sort) VALUES
('gallery/craft-1.jpg',1),('gallery/craft-2.jpg',2),('gallery/craft-3.jpg',3),('gallery/craft-4.jpg',4),
('gallery/craft-5.jpg',5),('gallery/craft-6.jpg',6),('gallery/craft-7.jpg',7),('gallery/craft-8.jpg',8),
('gallery/craft-9.jpg',9),('gallery/craft-10.jpg',10),('gallery/craft-11.jpg',11),('gallery/craft-12.jpg',12),
('gallery/craft-13.jpg',13),('gallery/craft-14.jpg',14),('gallery/craft-15.jpg',15),('gallery/craft-16.jpg',16),
('gallery/craft-17.jpg',17),('gallery/craft-18.jpg',18),('gallery/craft-19.jpg',19),('gallery/craft-20.jpg',20);
