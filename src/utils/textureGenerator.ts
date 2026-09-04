import * as THREE from 'three';

/**
 * Creates a procedural high-res keynote screen texture matching the reference image:
 * "SHAPING THE FUTURE TOGETHER" on a glowing cyan-blue neural constellation background.
 */
export function createKeynoteScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Background deep stage navy gradient
  const grad = ctx.createRadialGradient(
    canvas.width / 2, canvas.height * 0.7, 100,
    canvas.width / 2, canvas.height / 2, canvas.width * 0.8
  );
  grad.addColorStop(0, '#0052cc');
  grad.addColorStop(0.35, '#002666');
  grad.addColorStop(0.7, '#020b24');
  grad.addColorStop(1, '#010512');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Generate Constellation / Neural Network Data Mesh (like in photo)
  const nodes: { x: number; y: number; r: number }[] = [];
  const nodeCount = 140;

  // Left & Right density of nodes
  for (let i = 0; i < nodeCount; i++) {
    // Distribute more towards left, right, and bottom-center
    const side = Math.random() < 0.5 ? 0 : 1;
    const x = side === 0
      ? Math.random() * (canvas.width * 0.45)
      : canvas.width * 0.55 + Math.random() * (canvas.width * 0.45);
    const y = 200 + Math.random() * (canvas.height - 250);
    nodes.push({ x, y, r: Math.random() * 3.5 + 1.5 });
  }

  // Draw connecting luminous lines
  ctx.lineWidth = 1.2;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 180) {
        const alpha = (1 - dist / 180) * 0.45;
        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }

  // Draw Glowing Nodes
  for (const n of nodes) {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Reset shadow for crisp text
  ctx.shadowBlur = 0;

  // Glowing horizon stage floor reflection light at the bottom
  const bottomGlow = ctx.createLinearGradient(0, canvas.height - 120, 0, canvas.height);
  bottomGlow.addColorStop(0, 'rgba(56, 189, 248, 0)');
  bottomGlow.addColorStop(1, 'rgba(56, 189, 248, 0.45)');
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, canvas.height - 120, canvas.width, 120);

  // Main Keynote Title Text (Exact wording & style from photo)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 24;
  ctx.font = '900 82px "Montserrat", "Segoe UI", Inter, sans-serif';
  ctx.fillText(
    'OPEXN',
    canvas.width / 2,
    canvas.height * 0.52
  );


  // Sub-badge / Conference year
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#38bdf8';
  ctx.font = '600 24px "Segoe UI", Inter, sans-serif';
  ctx.fillText(
    ' LIVE FROM MAIN HALL',
    canvas.width / 2,
    canvas.height * 0.59
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates an illuminated Auditorium entrance gate sign
 */
export function createEntranceSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#05070e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);


  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px "Segoe UI", Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AUDITORIUM', canvas.width / 2, 145);



  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a door label texture
 */
export function createDoorSignTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 64px "Segoe UI", Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ENTER', canvas.width / 2, 220);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 44px "Segoe UI", Inter, sans-serif';
  ctx.fillText(label, canvas.width / 2, 300);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates procedural polished stage wood texture
 */
export function createWoodStageTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#1c120c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 512; i += 24) {
    ctx.fillStyle = i % 48 === 0 ? '#2a1a10' : '#1e130c';
    ctx.fillRect(0, i, 512, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, i + 22, 512, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 4);
  return texture;
}

/**
 * Creates rich warm auditorium patterned carpet texture (matching photo)
 */
export function createCarpetTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#301814'; // Warm deep auburn/charcoal base
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle geometric weave speckle
  for (let y = 0; y < 512; y += 8) {
    for (let x = 0; x < 512; x += 8) {
      const shade = Math.sin(x * 0.1) * Math.cos(y * 0.1);
      ctx.fillStyle = shade > 0 ? '#3d201b' : '#27120f';
      ctx.fillRect(x, y, 7, 7);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  return texture;
}

/**
 * Creates procedural marble foyer floor texture
 */
export function createMarbleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#202422ff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Tiles
  for (let x = 0; x < 512; x += 128) {
    for (let y = 0; y < 512; y += 128) {
      ctx.strokeStyle = 'rgba(152, 216, 14, 0.77)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, 128, 128);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}
