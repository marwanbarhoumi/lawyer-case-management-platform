-- Give lines created before the "position" column their previous (id) order
UPDATE "InvoiceItem" AS item
SET "position" = ordered.rn - 1
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "invoiceId" ORDER BY "id") AS rn
  FROM "InvoiceItem"
) AS ordered
WHERE item."id" = ordered."id";
