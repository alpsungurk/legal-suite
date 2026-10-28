// jspdf'in "exports" alanı yalnızca node / browser koşullarını tanır; sunucu (worker) derlemesi
// "jspdf"i çözemez. PDF yalnızca tarayıcıda üretildiği için tarayıcı dosyası doğrudan yüklenir.
declare module "jspdf/dist/jspdf.es.min.js" {
  export * from "jspdf";
}
