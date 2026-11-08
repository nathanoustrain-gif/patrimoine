import { useState } from "react";
import { db, uid, type Sealed } from "../../db/db";

export const SEALED_TYPES = [
  "ETB",
  "Bundle",
  "Display",
  "Coffret",
  "Booster",
  "Autre",
];

type Props = {
  initial?: Sealed;
  onDone: () => void;
  onDelete?: () => void;
};

export default function SealedForm({ initial, onDone, onDelete }: Props) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [extName, setExtName] = useState(initial?.setName ?? "");
  const [type, setType] = useState(initial?.type ?? "ETB");
  const [imageUrl, setImageUrl] = useState(initial?.image ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [purchasePrice, setPurchasePrice] = useState(
    initial?.purchasePrice != null ? String(initial.purchasePrice) : "",
  );
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? "");
  const [purchaseLocation, setPurchaseLocation] = useState(
    initial?.purchaseLocation ?? "",
  );
  const [marketPrice, setMarketPrice] = useState(
    initial?.marketPrice != null ? String(initial.marketPrice) : "",
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!name.trim() || !quantity) return;
    setSaving(true);
    const now = Date.now();
    const mp = marketPrice.trim() === "" ? undefined : parseFloat(marketPrice);
    const mpChanged = mp !== initial?.marketPrice;

    const item: Sealed = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      setName: extName.trim() || undefined,
      type,
      image: imageUrl.trim() || undefined,
      quantity: parseFloat(quantity) || 1,
      purchasePrice:
        purchasePrice.trim() === "" ? undefined : parseFloat(purchasePrice),
      purchaseDate: purchaseDate || undefined,
      purchaseLocation: purchaseLocation.trim() || undefined,
      marketPrice: mp,
      marketPriceDate:
        mp == null ? undefined : mpChanged ? now : initial?.marketPriceDate,
      note: note.trim() || undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };

    await db.sealed.put(item);
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="card-form">
      {imageUrl && (
        <div className="form-preview">
          <img src={imageUrl} alt={name} />
        </div>
      )}

      <div className="field">
        <label>Nom</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : ETB Ascended Heroes"
          required
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Extension</label>
          <input
            value={extName}
            onChange={(e) => setExtName(e.target.value)}
            placeholder="Ex : Ascended Heroes"
          />
        </div>
        <div className="field" style={{ maxWidth: 130 }}>
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {SEALED_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Image (URL, optionnel)</label>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div className="field-row">
        <div className="field" style={{ maxWidth: 110 }}>
          <label>Quantité</label>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Prix d'achat (€, unité)</label>
          <input
            type="number"
            step="any"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Date d'achat</label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Lieu d'achat</label>
          <input
            value={purchaseLocation}
            onChange={(e) => setPurchaseLocation(e.target.value)}
            placeholder="Ex : Cultura, eBay…"
          />
        </div>
      </div>

      <div className="field">
        <label>Prix de marché (€, unité) — saisi à la main</label>
        <input
          type="number"
          step="any"
          value={marketPrice}
          onChange={(e) => setMarketPrice(e.target.value)}
          placeholder="0,00"
        />
      </div>

      <div className="field">
        <label>Note (optionnel)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex : scellé, provenance…"
        />
      </div>

      <div className="form-actions">
        {onDelete ? (
          confirmDel ? (
            <button type="button" className="btn danger" onClick={onDelete}>
              Confirmer la suppression
            </button>
          ) : (
            <button
              type="button"
              className="btn danger-ghost"
              onClick={() => setConfirmDel(true)}
            >
              Supprimer
            </button>
          )
        ) : (
          <button type="button" className="btn" onClick={onDone}>
            Annuler
          </button>
        )}
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "…" : initial ? "Enregistrer" : "Ajouter au stock"}
        </button>
      </div>
    </form>
  );
}
