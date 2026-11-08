import { useEffect, useState } from "react";
import { db, uid, type Card } from "../../db/db";
import { fetchCardDetail, type ApiCard } from "../../lib/tcgcards";
import { fmtEUR, fmtDate } from "../../lib/format";
import { conditionFactor } from "../../lib/collection";

export const CONDITIONS = ["MT", "NM", "EX", "GD", "LP", "PL", "PO"];
export const LANGUAGES = ["EN", "FR", "JP", "DE", "IT", "ES"];

/** Codes langue de l'app → codes TCGdex. */
const FORM_TO_TCG: Record<string, string> = {
  EN: "en",
  FR: "fr",
  DE: "de",
  IT: "it",
  ES: "es",
  JP: "ja",
};

type Props = {
  /** carte issue de la recherche API (mode ajout API) */
  apiCard?: ApiCard;
  /** carte existante (mode édition) */
  initial?: Card;
  /** mode saisie manuelle (FR/JP…) */
  manual?: boolean;
  onDone: () => void;
  /** suppression (mode édition) */
  onDelete?: () => void;
};

export default function CardAddForm({
  apiCard,
  initial,
  manual,
  onDone,
  onDelete,
}: Props) {
  const [confirmDel, setConfirmDel] = useState(false);
  const base = initial ?? apiCard;
  const apiId = initial?.apiId ?? apiCard?.apiId;
  const isApi = !!apiId && !manual;

  const [name, setName] = useState(base?.name ?? "");
  const [extName, setExtName] = useState(base?.setName ?? "");
  const [number, setNumber] = useState(base?.number ?? "");
  const [imageUrl, setImageUrl] = useState(
    (initial?.image ?? apiCard?.image) ?? "",
  );
  const [language, setLanguage] = useState(
    initial?.language ??
      (apiCard?.apiLang === "fr" ? "FR" : apiCard ? "EN" : manual ? "FR" : "EN"),
  );
  const [condition, setCondition] = useState(initial?.condition ?? "NM");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [purchasePrice, setPurchasePrice] = useState(
    initial?.purchasePrice != null ? String(initial.purchasePrice) : "",
  );
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  // Prix API : en état (réactif), pour suivre les changements de langue.
  const [apiLang, setApiLang] = useState(initial?.apiLang ?? apiCard?.apiLang);
  const [apiPrice, setApiPrice] = useState<number | undefined>(
    initial?.marketPrice ?? apiCard?.marketPrice,
  );
  const [apiPriceDate, setApiPriceDate] = useState<number | undefined>(
    initial?.marketPriceDate ?? apiCard?.marketPriceDate,
  );
  const [priceLoading, setPriceLoading] = useState(false);

  // Prix forcé : pour API c'est manualPrice ; pour manuel c'est le prix de marché.
  const [manualPrice, setManualPrice] = useState(
    initial?.manualPrice != null
      ? String(initial.manualPrice)
      : !isApi && initial?.marketPrice != null
        ? String(initial.marketPrice)
        : "",
  );

  const [saving, setSaving] = useState(false);

  // Change de langue → re-récupère le prix de marché dans cette langue (API).
  useEffect(() => {
    if (!isApi || !apiId) return;
    const tcg = FORM_TO_TCG[language];
    if (!tcg || tcg === apiLang) return;
    let cancelled = false;
    setPriceLoading(true);
    fetchCardDetail(apiId, tcg)
      .then((d) => {
        if (cancelled) return;
        if (d) {
          setApiPrice(d.marketPrice);
          setApiPriceDate(d.marketPriceDate);
          setApiLang(tcg);
        }
        setPriceLoading(false);
      })
      .catch(() => {
        if (!cancelled) setPriceLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const adjustedPrice =
    apiPrice != null ? apiPrice * conditionFactor(condition) : undefined;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!name.trim() || !quantity) return;
    setSaving(true);
    const now = Date.now();
    const mp = manualPrice.trim() === "" ? undefined : parseFloat(manualPrice);

    const card: Card = {
      id: initial?.id ?? uid(),
      apiId: apiId || undefined,
      apiLang: apiLang || undefined,
      name: name.trim(),
      setName: extName.trim() || undefined,
      number: number.trim() || undefined,
      image: imageUrl.trim() || undefined,
      imageLarge: initial?.imageLarge ?? apiCard?.imageLarge,
      language,
      condition,
      quantity: parseFloat(quantity) || 1,
      purchasePrice:
        purchasePrice.trim() === "" ? undefined : parseFloat(purchasePrice),
      purchaseDate: purchaseDate || undefined,
      note: note.trim() || undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      // Prix
      marketPrice: isApi ? apiPrice : mp,
      marketPriceDate: isApi ? apiPriceDate : mp != null ? now : undefined,
      manualPrice: isApi ? mp : undefined,
    };

    await db.cards.put(card);
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
          readOnly={isApi}
          required
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Extension</label>
          <input
            value={extName}
            onChange={(e) => setExtName(e.target.value)}
            readOnly={isApi}
            placeholder="Ex : 151"
          />
        </div>
        <div className="field" style={{ maxWidth: 110 }}>
          <label>Numéro</label>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            readOnly={isApi}
            placeholder="6/165"
          />
        </div>
      </div>

      {!isApi && (
        <div className="field">
          <label>Image (URL, optionnel)</label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label>Langue</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>État</label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 90 }}>
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
      </div>

      <div className="field-row">
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
        <div className="field">
          <label>Date d'achat</label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>
      </div>

      {isApi && (
        <div className="market-note">
          Prix marché :{" "}
          <strong>
            {priceLoading
              ? "…"
              : adjustedPrice != null
                ? fmtEUR(adjustedPrice)
                : "indisponible"}
          </strong>
          {!priceLoading &&
            apiPrice != null &&
            condition !== "NM" &&
            condition !== "MT" && (
              <span style={{ color: "var(--paper-faint)" }}>
                {" "}
                (état {condition} · base {fmtEUR(apiPrice)})
              </span>
            )}
          {apiPriceDate ? " · maj " + fmtDate(apiPriceDate) : ""}
          <span style={{ display: "block", fontSize: 11, marginTop: 4, color: "var(--paper-faint)" }}>
            Ajusté selon l'état (estimation). Change la langue pour le prix de cette
            version.
          </span>
        </div>
      )}

      <div className="field">
        <label>
          {isApi ? "Forcer un prix de marché (€, optionnel)" : "Prix de marché (€)"}
        </label>
        <input
          type="number"
          step="any"
          value={manualPrice}
          onChange={(e) => setManualPrice(e.target.value)}
          placeholder={isApi ? "laisser vide pour garder le prix API" : "0,00"}
        />
      </div>

      <div className="field">
        <label>Note (optionnel)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex : gradée PSA 9"
        />
      </div>

      <div className="form-actions">
        {onDelete ? (
          confirmDel ? (
            <button
              type="button"
              className="btn danger"
              onClick={onDelete}
            >
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
          {saving ? "…" : initial ? "Enregistrer" : "Ajouter à la collection"}
        </button>
      </div>
    </form>
  );
}
