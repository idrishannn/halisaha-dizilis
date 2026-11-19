/*
 * Sabit perspektifli saha için küçük bir izdüşüm modülü.
 * 3D kütüphanesi kullanmadan sahayı eğik bir düzlem olarak çizer; çıktı düz SVG koordinatlarıdır,
 * bu yüzden PNG dışa aktarımında ekrandakiyle birebir aynı görünür.
 *
 * Saha birimi: 200 x 300 (genişlik x uzunluk). Orta saha çizgisi y = 150.
 * Alt yarı ev sahibi (kendi takımımız), üst yarı rakip.
 */

import type { Point } from '../types.ts';

export const PITCH_W = 200;
export const PITCH_L = 300;
export const HALFWAY = PITCH_L / 2;

/** Çizgilerin sınırı (saha kenarından içeride) */
export const LINES = { left: 8, right: 192, top: 10, bottom: 290 };

export interface Projected {
  x: number;
  y: number;
  /** Bu derinlikteki ölçek (1 = sahne merkezi) */
  s: number;
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Camera {
  project(px: number, py: number, height?: number): Projected;
  viewBox: ViewBox;
  /** Görünen saha aralığı (y ekseninde, saha birimi) */
  from: number;
  to: number;
}

export interface CameraOptions {
  /** Görünen bölgenin uzak ve yakın kenarı (saha birimi) */
  from: number;
  to: number;
  /** Eğim açısı, derece. 0 = tam üstten, 90 = yerden. */
  tilt: number;
  /** Odak uzaklığı; küçüldükçe perspektif güçlenir */
  focal: number;
  /** Kenar boşluğu (izdüşüm birimi) */
  margin?: number;
  /** viewBox hesabına katılacak en yüksek nokta (ör. çit yüksekliği) */
  tallest?: number;
  /**
   * Derinlik abartısı. Gerçek oranlı yarı saha eğilince çok sığ kalıyor ve oyuncular üst üste
   * biniyor; TV grafiklerindeki gibi derinliği biraz uzatıp sahayı okunur kılıyoruz.
   */
  depth?: number;
}

export function makeCamera({ from, to, tilt, focal, margin = 6, tallest = 0, depth = 1 }: CameraOptions): Camera {
  const a = (tilt * Math.PI) / 180;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const cy = (from + to) / 2;

  const project = (px: number, py: number, height = 0): Projected => {
    const X = px - PITCH_W / 2;
    const Y = (py - cy) * depth;
    // Düzlemi X ekseni etrafında döndür; yükseklik düzlemin normali yönünde
    const y = Y * cos - height * sin;
    const z = -Y * sin - height * cos;
    const s = focal / (focal + z);
    return { x: X * s, y: y * s, s };
  };

  // Görünen bölgenin köşeleri (zeminde ve en yüksek noktada) viewBox'ı belirler
  const pts: Projected[] = [];
  for (const px of [-10, PITCH_W + 10]) {
    for (const py of [from, to + 10]) {
      pts.push(project(px, py, 0), project(px, py, tallest));
    }
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs) - margin;
  const minY = Math.min(...ys) - margin;
  const viewBox = { x: minX, y: minY, w: Math.max(...xs) + margin - minX, h: Math.max(...ys) + margin - minY };

  return { project, viewBox, from, to };
}

/** İzdüşümü yapılmış noktaları SVG yoluna çevirir. */
export function pathOf(points: Projected[], close = false): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + (close ? ' Z' : '');
}

/** Zemindeki bir dikdörtgenin izdüşümü. */
export function quad(cam: Camera, x0: number, y0: number, x1: number, y1: number, h = 0): string {
  return pathOf([cam.project(x0, y0, h), cam.project(x1, y0, h), cam.project(x1, y1, h), cam.project(x0, y1, h)], true);
}

/** Zemindeki bir yay (açılar radyan, saha düzleminde). */
export function arc(cam: Camera, cx: number, cy: number, r: number, a0 = 0, a1 = Math.PI * 2, steps = 48): string {
  const pts: Projected[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = a0 + ((a1 - a0) * i) / steps;
    pts.push(cam.project(cx + Math.cos(t) * r, cy + Math.sin(t) * r));
  }
  return pathOf(pts);
}

/**
 * Takım koordinatını (kendi yarı sahasında yüzde) saha birimine çevirir.
 * Ev sahibi alt yarıda; rakip üst yarıda ve ayna simetrisiyle (kendi kalesi üstte).
 */
export function teamToPitch(p: Point, side: 'home' | 'away', inset = 0): { px: number; py: number } {
  const usableW = LINES.right - LINES.left;
  const usableL = LINES.bottom - HALFWAY;
  // inset: orta saha çizgisinden geri çekilme (yüzde). İki takım aynı sahadayken forvetler çakışmasın.
  const depth = (inset + (p.y / 100) * (100 - inset)) / 100;
  if (side === 'home') {
    return { px: LINES.left + (p.x / 100) * usableW, py: HALFWAY + depth * usableL };
  }
  return { px: LINES.right - (p.x / 100) * usableW, py: HALFWAY - depth * usableL };
}

/** Projected noktayı viewBox içinde yüzdeye çevirir (HTML katmanı için). */
export function toPercent(cam: Camera, p: Projected): { left: number; top: number } {
  return {
    left: ((p.x - cam.viewBox.x) / cam.viewBox.w) * 100,
    top: ((p.y - cam.viewBox.y) / cam.viewBox.h) * 100,
  };
}
