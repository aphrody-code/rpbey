/**
 * Burst de particules sur les pulls SR+ (halo brillant). Utilise un
 * ParticleContainer (PixiJS v8) pour rendre des centaines de paillettes en un
 * seul draw call. Chaque particule = un petit point généré une fois en texture
 * via le renderer (generateTexture), recyclé.
 */
import {
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  type Renderer,
  type Texture,
} from "pixi.js";

interface Spark {
  particle: Particle;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export class Particles extends Container {
  private pc: ParticleContainer;
  private sparks: Spark[] = [];
  private tex: Texture | null = null;

  constructor() {
    super();
    this.label = "particles";
    this.pc = new ParticleContainer({
      dynamicProperties: { position: true, scale: true, alpha: true, rotation: false },
    });
    this.addChild(this.pc);
  }

  /** Génère la texture de paillette une fois (point blanc doux). */
  private ensureTexture(renderer: Renderer): Texture {
    if (this.tex) return this.tex;
    const g = new Graphics();
    g.circle(8, 8, 8).fill({ color: 0xffffff, alpha: 0.9 });
    g.circle(8, 8, 4).fill({ color: 0xffffff, alpha: 1 });
    this.tex = renderer.generateTexture(g);
    g.destroy();
    return this.tex;
  }

  /** Émet `count` paillettes depuis (x,y), teintées `color`. */
  burst(renderer: Renderer, x: number, y: number, color: number, count: number): void {
    const tex = this.ensureTexture(renderer);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.06 + Math.random() * 0.22;
      const p = new Particle({
        texture: tex,
        x,
        y,
        scaleX: 0.4 + Math.random() * 0.8,
        scaleY: 0.4 + Math.random() * 0.8,
        tint: color,
        anchorX: 0.5,
        anchorY: 0.5,
      });
      this.pc.addParticle(p);
      const maxLife = 600 + Math.random() * 700;
      this.sparks.push({
        particle: p,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.05,
        life: 0,
        maxLife,
      });
    }
  }

  /** Avance la simulation (gravité légère + fondu). */
  update(deltaMS: number): void {
    if (this.sparks.length === 0) return;
    const survivors: Spark[] = [];
    for (const s of this.sparks) {
      s.life += deltaMS;
      const t = s.life / s.maxLife;
      if (t >= 1) {
        this.pc.removeParticle(s.particle);
        continue;
      }
      s.particle.x += s.vx * deltaMS;
      s.particle.y += s.vy * deltaMS;
      s.vy += 0.00018 * deltaMS; // gravité
      s.particle.alpha = 1 - t;
      survivors.push(s);
    }
    this.sparks = survivors;
    this.pc.update();
  }

  clear(): void {
    for (const s of this.sparks) this.pc.removeParticle(s.particle);
    this.sparks.length = 0;
  }
}
