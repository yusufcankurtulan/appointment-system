export const CATEGORIES = [
  { id: "berber", label: "Berber / Kuaför" },
  { id: "guzellik", label: "Güzellik Salonu" },
  { id: "spa", label: "Spa & Masaj" },
  { id: "dis", label: "Diş Kliniği" },
  { id: "doktor", label: "Doktor / Sağlık Merkezi" },
  { id: "veteriner", label: "Veteriner" },
  { id: "peyzaj", label: "Peyzaj / Bahçe Bakımı" },
  { id: "temizlik", label: "Temizlik Hizmeti" },
  { id: "emlak", label: "Emlak / Gayrimenkul" },
  { id: "oto", label: "Oto Servis / Yıkama" },
  { id: "fitness", label: "Fitness / Spor Salonu" },
  { id: "egitim", label: "Eğitim / Kurs" },
  { id: "fotograf", label: "Fotoğrafçı" },
  { id: "avukat", label: "Avukat / Hukuk" },
  { id: "danismanlik", label: "Danışmanlık / Muhasebe" },
  { id: "restoran", label: "Restoran / Kafe" },
  { id: "tattoo", label: "Dövme Stüdyosu" },
  { id: "nail", label: "Nail Art / Manikür" },
  { id: "psikolog", label: "Psikolog / Terapi" },
  { id: "fizyoterapi", label: "Fizyoterapi" },
  { id: "kuafor", label: "Kuaför" },
  { id: "optik", label: "Optik" },
  { id: "dugun", label: "Düğün / Organizasyon" },
  { id: "diger", label: "Diğer" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function getCategoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Diğer";
}
