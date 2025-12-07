export default async function handler(req: any, res: any) {
  // Endpoint desactivado al eliminar funcionalidad de IA
  return res.status(200).json({ commentary: "System: AI Offline." });
}