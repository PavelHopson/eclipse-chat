import type { DeckJobPayload } from "./deckJobContract.js";
import { createStoredZip } from "./zipArchive.js";

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CONTENT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const PRESENTATION_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const MAX_RENDERED_BYTES = 4 * 1024 * 1024;
const MAX_VISIBLE_CHARACTERS_PER_SLIDE = 1_800;
const EMU_PER_INCH = 914_400;

type Paragraph = { text: string; bullet?: boolean };

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function emu(inches: number): number {
  return Math.round(inches * EMU_PER_INCH);
}

function run(text: string, fontSize: number, color: string, bold: boolean): string {
  return `<a:r><a:rPr lang="ru-RU" sz="${fontSize * 100}" b="${bold ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/><a:cs typeface="Arial"/></a:rPr><a:t xml:space="preserve">${escapeXml(text)}</a:t></a:r>`;
}

function paragraph(item: Paragraph, fontSize: number, color: string, bold: boolean): string {
  const props = item.bullet
    ? '<a:pPr marL="342900" indent="-228600"><a:buClr><a:srgbClr val="8B5CF6"/></a:buClr><a:buChar char="•"/></a:pPr>'
    : '<a:pPr marL="0" indent="0"><a:buNone/></a:pPr>';
  return `<a:p>${props}${run(item.text, fontSize, color, bold)}<a:endParaRPr lang="ru-RU" sz="${fontSize * 100}"/></a:p>`;
}

function textBox(options: {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  paragraphs: Paragraph[];
  fontSize: number;
  color: string;
  bold?: boolean;
  fill?: string;
  border?: string;
  margin?: number;
}): string {
  const fill = options.fill
    ? `<a:solidFill><a:srgbClr val="${options.fill}"/></a:solidFill>`
    : "<a:noFill/>";
  const line = options.border
    ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${options.border}"/></a:solidFill></a:ln>`
    : "<a:ln><a:noFill/></a:ln>";
  const margin = emu(options.margin ?? 0.08);
  return `<p:sp><p:nvSpPr><p:cNvPr id="${options.id}" name="${escapeXml(options.name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(options.x)}" y="${emu(options.y)}"/><a:ext cx="${emu(options.w)}" cy="${emu(options.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}${line}</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="${margin}" tIns="${margin}" rIns="${margin}" bIns="${margin}" anchor="t"><a:normAutofit fontScale="85000" lnSpcReduction="15000"/></a:bodyPr><a:lstStyle/>${options.paragraphs.map((item) => paragraph(item, options.fontSize, options.color, options.bold ?? false)).join("")}</p:txBody></p:sp>`;
}

function shapeTree(shapes: string): string {
  return `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree>`;
}

function slideXml(job: DeckJobPayload, slide: DeckJobPayload["slides"][number], index: number): string {
  const visibleCharacters = slide.title.length + slide.bullets.reduce((sum, bullet) => sum + bullet.length, 0);
  if (visibleCharacters > MAX_VISIBLE_CHARACTERS_PER_SLIDE) {
    throw new Error(`Слайд ${index + 1} перегружен текстом. Сократите его до ${MAX_VISIBLE_CHARACTERS_PER_SLIDE} символов.`);
  }

  const bodyFontSize = visibleCharacters > 1_350 ? 14 : visibleCharacters > 900 ? 16 : visibleCharacters > 520 ? 19 : 22;
  const isCover = slide.kind === "cover";
  const shapes: string[] = [];
  let id = 2;
  shapes.push(textBox({ id: id++, name: "Accent", x: 0.72, y: 0.55, w: isCover ? 1.25 : 0.68, h: 0.07, paragraphs: [{ text: "" }], fontSize: 1, color: "8B5CF6", fill: "8B5CF6", margin: 0 }));

  if (isCover) {
    shapes.push(textBox({ id: id++, name: "Deck title", x: 0.72, y: 1.05, w: 11.8, h: 1.65, paragraphs: [{ text: slide.title }], fontSize: 38, color: "F8FAFC", bold: true }));
    shapes.push(textBox({ id: id++, name: "Objective", x: 0.75, y: 3.05, w: 10.9, h: 1.4, paragraphs: [{ text: job.input.objective }], fontSize: 20, color: "CBD5E1" }));
    shapes.push(textBox({ id: id++, name: "Audience", x: 0.75, y: 5.65, w: 8.8, h: 0.55, paragraphs: [{ text: `Для кого: ${job.input.audience}` }], fontSize: 13, color: "94A3B8" }));
  } else {
    shapes.push(textBox({ id: id++, name: "Slide kind", x: 0.68, y: 0.32, w: 3.0, h: 0.36, paragraphs: [{ text: slide.kind.toUpperCase() }], fontSize: 10, color: "A78BFA", bold: true }));
    shapes.push(textBox({ id: id++, name: "Slide title", x: 0.68, y: 0.82, w: 11.8, h: 0.9, paragraphs: [{ text: slide.title }], fontSize: 29, color: "F8FAFC", bold: true }));
    shapes.push(textBox({ id: id++, name: "Slide body", x: 0.78, y: 1.88, w: 11.5, h: 4.65, paragraphs: slide.bullets.map((text) => ({ text, bullet: true })), fontSize: bodyFontSize, color: "DCE4F0" }));
  }

  const sourceLabel = slide.sourceRefs.length > 0 ? `Источники: ${slide.sourceRefs.join(" · ")}` : "Проверено в Eclipse Chat";
  shapes.push(textBox({ id: id++, name: "Provenance", x: 0.68, y: 6.78, w: 10.8, h: 0.32, paragraphs: [{ text: sourceLabel }], fontSize: 9, color: "64748B" }));
  shapes.push(textBox({ id, name: "Slide number", x: 12.1, y: 6.72, w: 0.55, h: 0.34, paragraphs: [{ text: String(index + 1) }], fontSize: 10, color: "94A3B8", bold: true }));

  return `${XML}<p:sld xmlns:a="${DRAWING_NS}" xmlns:r="${OFFICE_REL}" xmlns:p="${PRESENTATION_NS}"><p:cSld name="${escapeXml(slide.title)}"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="0B1020"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>${shapeTree(shapes.join(""))}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function notesXml(job: DeckJobPayload, slide: DeckJobPayload["slides"][number], index: number): string {
  const provenance = [
    slide.speakerNotes || "Заметки докладчика не добавлены.",
    slide.sourceRefs.length > 0 ? `Source refs: ${slide.sourceRefs.join(", ")}` : "Source refs: none",
    ...job.input.evidenceUrls.map((url) => `Evidence: ${url}`),
  ];
  const paragraphs = provenance.map((text) => paragraph({ text }, 12, "1E293B", false)).join("");
  const noteShape = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes ${index + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4572000"/><a:ext cx="5486400" cy="3657600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
  return `${XML}<p:notes xmlns:a="${DRAWING_NS}" xmlns:r="${OFFICE_REL}" xmlns:p="${PRESENTATION_NS}"><p:cSld name="Notes ${index + 1}">${shapeTree(noteShape)}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

function relationship(id: string, type: string, target: string): string {
  return `<Relationship Id="${id}" Type="${OFFICE_REL}/${type}" Target="${target}"/>`;
}

function relationships(items: string[]): string {
  return `${XML}<Relationships xmlns="${REL_NS}">${items.join("")}</Relationships>`;
}

const THEME_XML = `${XML}<a:theme xmlns:a="${DRAWING_NS}" name="Eclipse Forge"><a:themeElements><a:clrScheme name="Eclipse Forge"><a:dk1><a:srgbClr val="0B1020"/></a:dk1><a:lt1><a:srgbClr val="F8FAFC"/></a:lt1><a:dk2><a:srgbClr val="1E293B"/></a:dk2><a:lt2><a:srgbClr val="E2E8F0"/></a:lt2><a:accent1><a:srgbClr val="8B5CF6"/></a:accent1><a:accent2><a:srgbClr val="D4AF37"/></a:accent2><a:accent3><a:srgbClr val="22C55E"/></a:accent3><a:accent4><a:srgbClr val="38BDF8"/></a:accent4><a:accent5><a:srgbClr val="F97316"/></a:accent5><a:accent6><a:srgbClr val="EF4444"/></a:accent6><a:hlink><a:srgbClr val="60A5FA"/></a:hlink><a:folHlink><a:srgbClr val="A78BFA"/></a:folHlink></a:clrScheme><a:fontScheme name="Eclipse Forge"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Eclipse Forge"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="dk1"/></a:solidFill><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

const EMPTY_TREE = shapeTree("");
const COLOR_MAP = '<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>';
const TEXT_STYLE = '<a:lvl1pPr marL="0" indent="0"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr>';
const SLIDE_MASTER_XML = `${XML}<p:sldMaster xmlns:a="${DRAWING_NS}" xmlns:r="${OFFICE_REL}" xmlns:p="${PRESENTATION_NS}"><p:cSld name="Eclipse Forge">${EMPTY_TREE}</p:cSld>${COLOR_MAP}<p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle>${TEXT_STYLE}</p:titleStyle><p:bodyStyle>${TEXT_STYLE}</p:bodyStyle><p:otherStyle>${TEXT_STYLE}</p:otherStyle></p:txStyles></p:sldMaster>`;
const SLIDE_LAYOUT_XML = `${XML}<p:sldLayout xmlns:a="${DRAWING_NS}" xmlns:r="${OFFICE_REL}" xmlns:p="${PRESENTATION_NS}" type="blank" preserve="1"><p:cSld name="Blank">${EMPTY_TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
const NOTES_MASTER_XML = `${XML}<p:notesMaster xmlns:a="${DRAWING_NS}" xmlns:r="${OFFICE_REL}" xmlns:p="${PRESENTATION_NS}"><p:cSld name="Eclipse Notes">${EMPTY_TREE}</p:cSld>${COLOR_MAP}<p:notesStyle>${TEXT_STYLE}</p:notesStyle></p:notesMaster>`;

function contentTypes(slideCount: number): string {
  const slides = Array.from({ length: slideCount }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/notesSlides/notesSlide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`).join("");
  return `${XML}<Types xmlns="${CONTENT_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function presentationXml(slideCount: number): string {
  const ids = Array.from({ length: slideCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 3}"/>`).join("");
  return `${XML}<p:presentation xmlns:a="${DRAWING_NS}" xmlns:r="${OFFICE_REL}" xmlns:p="${PRESENTATION_NS}" saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle>${TEXT_STYLE}</p:defaultTextStyle></p:presentation>`;
}

function safeFilename(title: string): string {
  const normalized = title.normalize("NFKC").replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return `${(normalized || "Eclipse deck").slice(0, 80)}.pptx`;
}

export type RenderedDeck = { buffer: Buffer; filename: string };

export function renderDeckPptx(job: DeckJobPayload): RenderedDeck {
  const slideCount = job.slides.length;
  const entries: Array<{ name: string; data: string }> = [
    { name: "[Content_Types].xml", data: contentTypes(slideCount) },
    { name: "_rels/.rels", data: relationships([
      relationship("rId1", "officeDocument", "ppt/presentation.xml"),
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
      relationship("rId3", "extended-properties", "docProps/app.xml"),
    ]) },
    { name: "docProps/core.xml", data: `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(job.input.title)}</dc:title><dc:creator>Eclipse Chat</dc:creator><cp:lastModifiedBy>Eclipse Chat</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(job.createdAt)}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(job.updatedAt)}</dcterms:modified><cp:revision>1</cp:revision></cp:coreProperties>` },
    { name: "docProps/app.xml", data: `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Eclipse Chat</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>${slideCount}</Slides><Notes>${slideCount}</Notes><Company>Eclipse Forge</Company><AppVersion>1.7</AppVersion></Properties>` },
    { name: "ppt/presentation.xml", data: presentationXml(slideCount) },
    { name: "ppt/presProps.xml", data: `${XML}<p:presentationPr xmlns:a="${DRAWING_NS}" xmlns:r="${OFFICE_REL}" xmlns:p="${PRESENTATION_NS}"/>` },
    { name: "ppt/_rels/presentation.xml.rels", data: relationships([
      relationship("rId1", "slideMaster", "slideMasters/slideMaster1.xml"),
      relationship("rId2", "notesMaster", "notesMasters/notesMaster1.xml"),
      ...Array.from({ length: slideCount }, (_, index) => relationship(`rId${index + 3}`, "slide", `slides/slide${index + 1}.xml`)),
      relationship(`rId${slideCount + 3}`, "presProps", "presProps.xml"),
    ]) },
    { name: "ppt/slideMasters/slideMaster1.xml", data: SLIDE_MASTER_XML },
    { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: relationships([relationship("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"), relationship("rId2", "theme", "../theme/theme1.xml")]) },
    { name: "ppt/slideLayouts/slideLayout1.xml", data: SLIDE_LAYOUT_XML },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: relationships([relationship("rId1", "slideMaster", "../slideMasters/slideMaster1.xml")]) },
    { name: "ppt/notesMasters/notesMaster1.xml", data: NOTES_MASTER_XML },
    { name: "ppt/notesMasters/_rels/notesMaster1.xml.rels", data: relationships([relationship("rId1", "theme", "../theme/theme1.xml")]) },
    { name: "ppt/theme/theme1.xml", data: THEME_XML },
  ];

  job.slides.forEach((slide, index) => {
    const number = index + 1;
    entries.push(
      { name: `ppt/slides/slide${number}.xml`, data: slideXml(job, slide, index) },
      { name: `ppt/slides/_rels/slide${number}.xml.rels`, data: relationships([relationship("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"), relationship("rId2", "notesSlide", `../notesSlides/notesSlide${number}.xml`)]) },
      { name: `ppt/notesSlides/notesSlide${number}.xml`, data: notesXml(job, slide, index) },
      { name: `ppt/notesSlides/_rels/notesSlide${number}.xml.rels`, data: relationships([relationship("rId1", "notesMaster", "../notesMasters/notesMaster1.xml"), relationship("rId2", "slide", `../slides/slide${number}.xml`)]) },
    );
  });

  const buffer = createStoredZip(entries);
  if (buffer.length > MAX_RENDERED_BYTES) throw new Error("PPTX превышает безопасный лимит 4 МБ");
  return { buffer, filename: safeFilename(job.input.title) };
}

export function encodeRfc5987Filename(filename: string): string {
  return encodeURIComponent(filename).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}
