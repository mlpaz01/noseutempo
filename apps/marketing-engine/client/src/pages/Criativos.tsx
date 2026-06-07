import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  ImageIcon,
  Loader2,
  CheckCircle,
  XCircle,
  Link2,
  RotateCcw,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHANNELS = ["linkedin", "tiktok", "instagram", "google"] as const;

export default function Criativos() {
  const utils = trpc.useUtils();
  const { data: creatives, isLoading } = trpc.creatives.list.useQuery({ campaignId: undefined });
  const { data: campaigns } = trpc.campaigns.list.useQuery();

  const addMutation = trpc.creatives.addFromUrl.useMutation({
    onSuccess: () => {
      utils.creatives.list.invalidate();
      setBriefing("");
      setImageUrl("");
      setSelectedChannels([]);
      setSelectedCampaignId(undefined);
      toast.success("Criativo adicionado com sucesso!");
    },
    onError: (e) => {
      toast.error(`Erro: ${e.message}`);
    },
  });

  const updateStatusMutation = trpc.creatives.updateStatus.useMutation({
    onSuccess: () => utils.creatives.list.invalidate(),
  });

  const linkMutation = trpc.creatives.linkToCampaign.useMutation({
    onSuccess: () => {
      utils.creatives.list.invalidate();
      setLinkOpen(false);
      toast.success("Criativo vinculado à campanha!");
    },
  });

  const [briefing, setBriefing] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | undefined>();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkCreativeId, setLinkCreativeId] = useState<number | null>(null);
  const [linkCampaignId, setLinkCampaignId] = useState<number | null>(null);

  function toggleChannel(ch: string) {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  }

  function handleAdd() {
    if (!briefing.trim() || briefing.length < 3) {
      toast.error("Adicione uma descrição com pelo menos 3 caracteres.");
      return;
    }
    if (!imageUrl.trim()) {
      toast.error("Informe a URL da imagem.");
      return;
    }
    addMutation.mutate({
      briefing,
      imageUrl,
      campaignId: selectedCampaignId,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
    });
  }

  function openLink(creativeId: number) {
    setLinkCreativeId(creativeId);
    setLinkOpen(true);
  }

  return (
    <AppLayout
      title="Biblioteca de Criativos"
      subtitle="Adicione imagens exportadas do ChatGPT ou outra ferramenta"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add panel */}
        <div className="lg:col-span-1">
          <div className="card-premium p-6 sticky top-24">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-lg bg-primary/10">
                <Upload className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Adicionar Criativo</h2>
                <p className="text-xs text-muted-foreground">Cole a URL da imagem</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">URL da Imagem *</Label>
                <Input
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Cole a URL da imagem gerada no ChatGPT ou outra ferramenta
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descrição *</Label>
                <Textarea
                  placeholder="Descreva brevemente este criativo..."
                  value={briefing}
                  onChange={(e) => setBriefing(e.target.value)}
                  className="bg-background border-border resize-none h-24 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Canais de destino</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CHANNELS.map((ch) => (
                    <label
                      key={ch}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-xs ${
                        selectedChannels.includes(ch)
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-border/80"
                      }`}
                    >
                      <Checkbox
                        checked={selectedChannels.includes(ch)}
                        onCheckedChange={() => toggleChannel(ch)}
                      />
                      <ChannelBadge channel={ch} />
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Vincular à campanha (opcional)</Label>
                <select
                  value={selectedCampaignId ?? ""}
                  onChange={(e) => setSelectedCampaignId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Sem campanha</option>
                  {(campaigns ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleAdd}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Adicionar Criativo
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Creatives grid */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">
              Criativos
              {creatives && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">({creatives.length})</span>
              )}
            </h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square bg-card animate-pulse rounded-xl border border-border" />
              ))}
            </div>
          ) : !creatives || creatives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-base font-medium text-muted-foreground">Nenhum criativo adicionado</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Cole a URL de uma imagem criada no ChatGPT para adicionar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {creatives.map((creative) => (
                <div key={creative.id} className="card-premium overflow-hidden group">
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {creative.imageUrl ? (
                      <img
                        src={creative.imageUrl}
                        alt="Criativo"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <StatusBadge status={creative.status} />
                    </div>
                  </div>

                  <div className="p-3">
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{creative.briefing}</p>
                    <div className="flex items-center gap-1 flex-wrap mb-3">
                      {(creative.channels as string[] | null)?.map((ch) => (
                        <ChannelBadge key={ch} channel={ch} showLabel={false} />
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {creative.status === "aprovado" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 text-xs h-7"
                            onClick={() => openLink(creative.id)}
                          >
                            <Link2 className="w-3 h-3" /> Vincular
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-destructive hover:text-destructive"
                            onClick={() => updateStatusMutation.mutate({ id: creative.id, status: "rejeitado" })}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {creative.status === "rejeitado" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1.5 text-xs h-7"
                          onClick={() => updateStatusMutation.mutate({ id: creative.id, status: "aprovado" })}
                        >
                          <RotateCcw className="w-3 h-3" /> Restaurar
                        </Button>
                      )}
                      {creative.status === "em_uso" && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Em uso ({creative.usageCount}x)
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-2">
                      {format(new Date(creative.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Vincular a uma Campanha</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs text-muted-foreground">Selecione a campanha</Label>
            <select
              value={linkCampaignId ?? ""}
              onChange={(e) => setLinkCampaignId(Number(e.target.value))}
              className="w-full h-9 px-3 mt-1.5 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Selecione...</option>
              {(campaigns ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (linkCreativeId && linkCampaignId) {
                  linkMutation.mutate({ id: linkCreativeId, campaignId: linkCampaignId });
                }
              }}
              disabled={!linkCampaignId || linkMutation.isPending}
            >
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
