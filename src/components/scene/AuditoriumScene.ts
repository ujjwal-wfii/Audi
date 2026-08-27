import * as THREE from 'three';
import gsap from 'gsap';
import { SeatData, PovPosition } from '@/types/auditorium';
import { STAGE_CENTER, ROW_CONFIGS } from '@/utils/seatLayout';
import {
  createKeynoteScreenTexture,
  createEntranceSignTexture,
  createDoorSignTexture,
  createWoodStageTexture,
  createCarpetTexture,
  createMarbleTexture,
} from '@/utils/textureGenerator';

export interface PovConfig {
  id: PovPosition;
  name: string;
  badge: string;
  description: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  associatedSeatId: string;
}

// 3 Best Seat POVs: 90% Screen Viewport Immersion with Direct Frontal Gaze (Delta Y = 0) and Zero Hindrance
export const POV_PRESETS: Record<PovPosition, PovConfig> = {
  LEFT: {
    id: 'LEFT',
    name: 'Left VIP Seat POV',
    badge: 'Left VIP • 90% Screen Immersion',
    description: 'Direct straight-on frontal presentation view with 90% screen viewport occupancy',
    position: new THREE.Vector3(-3.2, 5.0, 1.2),
    lookAt: new THREE.Vector3(0.4, 5.0, -8.5),
    associatedSeatId: 'C-3',
  },
  CENTER: {
    id: 'CENTER',
    name: 'Center VIP Sweet-Spot POV',
    badge: 'Center Sweet-Spot • 90% Screen Immersion',
    description: 'Prime central direct presentation view with 90% screen viewport occupancy',
    position: new THREE.Vector3(0, 5.0, 0.8),
    lookAt: new THREE.Vector3(0, 5.0, -8.5),
    associatedSeatId: 'C-10',
  },
  RIGHT: {
    id: 'RIGHT',
    name: 'Right VIP Seat POV',
    badge: 'Right VIP • 90% Screen Immersion',
    description: 'Direct straight-on frontal presentation view with 90% screen viewport occupancy',
    position: new THREE.Vector3(3.2, 5.0, 1.2),
    lookAt: new THREE.Vector3(-0.4, 5.0, -8.5),
    associatedSeatId: 'C-18',
  },
};

export interface SceneCallbacks {
  onGateHover: (hovering: boolean) => void;
  onStateChange: (state: 'LOBBY' | 'ENTERING' | 'SEATED' | 'CHANGING_SEAT' | 'OVERVIEW') => void;
  onPovChange: (pov: PovPosition) => void;
}

export class AuditoriumScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private callbacks: SceneCallbacks;

  // State
  private currentPov: PovPosition = 'CENTER';
  private currentState: 'LOBBY' | 'ENTERING' | 'SEATED' | 'CHANGING_SEAT' | 'OVERVIEW' = 'LOBBY';
  private isMouseLooking = true;
  private mouse = new THREE.Vector2();
  private targetLookAt = new THREE.Vector3(0, 5.0, -8.5);
  private currentLookAt = new THREE.Vector3(0, 2.2, 30);
  private mouseOffset = { x: 0, y: 0 };

  // 3D Objects & Meshes
  private seatMeshes: Map<string, THREE.Group> = new Map();
  private seatPositions: Map<string, THREE.Vector3> = new Map();
  private tierMeshes: THREE.Mesh[] = [];
  private leftDoorGroup: THREE.Group = new THREE.Group();
  private rightDoorGroup: THREE.Group = new THREE.Group();
  private gateHitbox: THREE.Mesh | null = null;
  private activeBeaconRing: THREE.Mesh | null = null;
  private raycaster = new THREE.Raycaster();
  private interactiveObjects: THREE.Object3D[] = [];

  // Lights
  private ambientLight!: THREE.AmbientLight;
  private stageSpot1!: THREE.SpotLight;
  private stageSpot2!: THREE.SpotLight;
  private centerSpot!: THREE.SpotLight;
  private houseLight!: THREE.DirectionalLight;
  private screenMesh!: THREE.Mesh;

  // Animation frame
  private animationFrameId: number | null = null;
  private isDestroyed = false;

  constructor(container: HTMLElement, seats: SeatData[], callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // Initialize Three.js core
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060810);
    this.scene.fog = new THREE.FogExp2(0x060810, 0.007);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Camera with 54° FOV: Keynote Screen occupies 90% of viewport when seated
    this.camera = new THREE.PerspectiveCamera(54, width / height, 0.05, 200);
    // Initial camera in Lobby
    this.camera.position.set(0, 2.2, 38);
    this.currentLookAt.set(0, 2.2, 30);
    this.camera.lookAt(this.currentLookAt);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    container.appendChild(this.renderer.domElement);

    // Build World
    this.setupLighting();
    this.buildAuditoriumHall();
    this.buildEntranceLobby();
    this.buildSeatingArea(seats);

    // Event listeners
    this.onWindowResize = this.onWindowResize.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onClick = this.onClick.bind(this);

    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('click', this.onClick);

    // Start loop
    this.animate = this.animate.bind(this);
    this.animate();
  }

  /* -------------------------------------------------------------
     LIGHTING SETUP
  ------------------------------------------------------------- */
  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0x1e283d, 1.0);
    this.scene.add(this.ambientLight);

    this.houseLight = new THREE.DirectionalLight(0xffecd2, 0.7);
    this.houseLight.position.set(0, 24, 12);
    this.houseLight.castShadow = true;
    this.houseLight.shadow.mapSize.width = 2048;
    this.houseLight.shadow.mapSize.height = 2048;
    this.scene.add(this.houseLight);

    // Stage Spotlights
    this.stageSpot1 = new THREE.SpotLight(0x38bdf8, 5.5, 55, Math.PI / 4, 0.35, 1);
    this.stageSpot1.position.set(-15, 16, 4);
    this.stageSpot1.target.position.set(STAGE_CENTER.x - 2, 5.0, -8.5);
    this.scene.add(this.stageSpot1);
    this.scene.add(this.stageSpot1.target);

    this.stageSpot2 = new THREE.SpotLight(0x818cf8, 5.0, 55, Math.PI / 4, 0.35, 1);
    this.stageSpot2.position.set(15, 16, 4);
    this.stageSpot2.target.position.set(STAGE_CENTER.x + 2, 5.0, -8.5);
    this.scene.add(this.stageSpot2);
    this.scene.add(this.stageSpot2.target);

    // Center Stage Warm Keynote Light
    this.centerSpot = new THREE.SpotLight(0xfffae0, 6.5, 45, Math.PI / 5, 0.25);
    this.centerSpot.position.set(0, 18, -1);
    this.centerSpot.target.position.set(0, 5.0, -8.5);
    this.scene.add(this.centerSpot);
    this.scene.add(this.centerSpot.target);

    // Stage Soft Blue Floor Glow
    const stageBlueLight = new THREE.PointLight(0x0284c7, 4.0, 25);
    stageBlueLight.position.set(0, 2.5, -7.5);
    this.scene.add(stageBlueLight);

    // Entrance Gate Downlight
    const lobbyLight = new THREE.PointLight(0x60a5fa, 3.0, 18);
    lobbyLight.position.set(0, 4.5, 36);
    this.scene.add(lobbyLight);
  }

  /* -------------------------------------------------------------
     STAGE & AUDITORIUM HALL (90% SCREEN VIEWPORT IMMERSION)
  ------------------------------------------------------------- */
  private buildAuditoriumHall() {
    const carpetTex = createCarpetTexture();
    const woodTexture = createWoodStageTexture();

    // 1. Stage Platform
    const stageWidth = 28;
    const stageHeight = 1.2;

    const stageMaterial = new THREE.MeshStandardMaterial({
      map: woodTexture,
      roughness: 0.25,
      metalness: 0.15,
    });

    const stageGeo = new THREE.CylinderGeometry(
      stageWidth / 2,
      stageWidth / 2 + 0.8,
      stageHeight,
      48,
      1,
      false,
      0,
      Math.PI
    );
    const stage = new THREE.Mesh(stageGeo, stageMaterial);
    stage.rotation.y = -Math.PI / 2;
    stage.position.set(STAGE_CENTER.x, stageHeight / 2, -7.5);
    stage.receiveShadow = true;
    this.scene.add(stage);

    // 2. Large Curved Keynote Screen (90% Viewport Occupancy, Center at Y = 5.0, Z = -8.5)
    const screenHeight = 13.0;
    const screenRadius = 18;
    const screenArc = 1.45; // ~83 degree wide immersive panoramic screen

    const screenGeo = new THREE.CylinderGeometry(
      screenRadius,
      screenRadius,
      screenHeight,
      64,
      1,
      true,
      -screenArc / 2,
      screenArc
    );

    const screenTexture = createKeynoteScreenTexture();
    screenTexture.wrapS = THREE.RepeatWrapping;
    screenTexture.repeat.set(-1, 1);
    screenTexture.center.set(0.5, 0.5);
    screenTexture.needsUpdate = true;

    const screenMat = new THREE.MeshBasicMaterial({
      map: screenTexture,
      side: THREE.DoubleSide,
    });

    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    // Positioned directly at frontal eye-level Y = 5.0, Z = -8.5
    this.screenMesh.position.set(0, 5.0, -8.5);
    this.screenMesh.rotation.y = Math.PI;
    this.scene.add(this.screenMesh);

    // Screen Bezel Outer Frame
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x050811,
      roughness: 0.4,
      metalness: 0.6,
    });
    const frameMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(screenRadius + 0.12, screenRadius + 0.12, screenHeight + 0.35, 64, 1, true, -screenArc / 2 - 0.01, screenArc + 0.02),
      frameMat
    );
    frameMesh.position.copy(this.screenMesh.position);
    frameMesh.rotation.y = Math.PI;
    this.scene.add(frameMesh);

    // 3. Stage Speaker Podium / Lectern
    const podiumGeo = new THREE.BoxGeometry(1.2, 1.25, 0.8);
    const podiumMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.7 });
    const podium = new THREE.Mesh(podiumGeo, podiumMat);
    podium.position.set(-8.5, stageHeight + 0.62, -6.5);
    podium.rotation.y = 0.5;
    this.scene.add(podium);

    // 4. Acoustic Wooden Slat Side Walls
    const wallWoodMat = new THREE.MeshStandardMaterial({
      color: 0x422617,
      roughness: 0.5,
      metalness: 0.1,
    });

    const sconceGlowMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

    for (const side of [-1, 1]) {
      const wallGeo = new THREE.BoxGeometry(0.6, 18, 46);
      const wall = new THREE.Mesh(wallGeo, wallWoodMat);
      wall.position.set(side * 24, 9, 10);
      wall.rotation.y = side * -0.07;
      this.scene.add(wall);

      for (let i = 0; i < 9; i++) {
        const finGeo = new THREE.BoxGeometry(0.35, 12, 1.4);
        const fin = new THREE.Mesh(finGeo, wallWoodMat);
        fin.position.set(side * 23.4, 7.2, -5 + i * 4.2);
        fin.rotation.y = side * -0.28;
        this.scene.add(fin);

        if (i % 2 === 1) {
          const sconceGeo = new THREE.BoxGeometry(0.2, 0.8, 0.3);
          const sconce = new THREE.Mesh(sconceGeo, sconceGlowMat);
          sconce.position.set(side * 23.2, 7.0, -5 + i * 4.2);
          this.scene.add(sconce);
        }
      }
    }
    const tierCarpetMat = new THREE.MeshStandardMaterial({
      map: carpetTex,
      roughness: 0.85,
    });

    // 5. Tiered Stepped Floor Risers (STORED IN tierMeshes SO WE CAN HIDE THEM IN POV MODE TO PREVENT ANY STRIPS IN FRONT OF SCREEN)
    // const tierCarpetMat = new THREE.MeshStandardMaterial({
    //   map: carpetTex,
    //   roughness: 0.85,
    // });

    // const tierFrontMat = new THREE.MeshStandardMaterial({
    //   color: 0x1f140e,
    //   roughness: 0.6,
    // });

    // const stepAmberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    // const seatingArcSpan = 1.30;

    // ROW_CONFIGS.forEach((rowConfig, idx) => {
    //   const { radius, elevation } = rowConfig;
    //   const innerR = radius - 0.95;
    //   const outerR = radius + 1.15;

    //   const riserGeo = new THREE.RingGeometry(innerR, outerR, 48, 1, -seatingArcSpan / 2, seatingArcSpan);
    //   const riserMesh = new THREE.Mesh(riserGeo, tierCarpetMat);
    //   riserMesh.rotation.x = -Math.PI / 2;
    //   riserMesh.rotation.z = Math.PI / 2;
    //   riserMesh.position.set(STAGE_CENTER.x, elevation - 0.01, STAGE_CENTER.z);
    //   riserMesh.receiveShadow = true;
    //   this.scene.add(riserMesh);
    //   this.tierMeshes.push(riserMesh);

    //   const fasciaHeight = idx === 0 ? elevation : elevation - ROW_CONFIGS[idx - 1].elevation;
    //   const fasciaGeo = new THREE.CylinderGeometry(
    //     innerR,
    //     innerR,
    //     fasciaHeight,
    //     48,
    //     1,
    //     true,
    //     -seatingArcSpan / 2,
    //     seatingArcSpan
    //   );
    //   const fasciaMesh = new THREE.Mesh(fasciaGeo, tierFrontMat);
    //   fasciaMesh.rotation.y = Math.PI;
    //   fasciaMesh.position.set(STAGE_CENTER.x, elevation - fasciaHeight / 2, STAGE_CENTER.z);
    //   this.scene.add(fasciaMesh);
    //   this.tierMeshes.push(fasciaMesh);

    //   const aisleStepGeo = new THREE.BoxGeometry(1.6, 0.02, 0.08);
    //   const aisleStepLight = new THREE.Mesh(aisleStepGeo, stepAmberMat);
    //   aisleStepLight.position.set(0, elevation + 0.01, STAGE_CENTER.z + innerR);
    //   this.scene.add(aisleStepLight);
    //   this.tierMeshes.push(aisleStepLight);
    // });

    // 6. Solid Flat Ground Floor
    const groundFloorGeo = new THREE.PlaneGeometry(42, 30);
    const groundFloorMesh = new THREE.Mesh(groundFloorGeo, tierCarpetMat);
    groundFloorMesh.rotation.x = -Math.PI / 2;
    groundFloorMesh.position.set(0, 0, 4);
    this.scene.add(groundFloorMesh);

    // 7. Dark Ceiling with Overhead Spotlights & Architectural Beams
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x05070e, roughness: 0.9 });
    const ceilingMesh = new THREE.Mesh(new THREE.PlaneGeometry(48, 52), ceilingMat);
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(0, 16.5, 12);
    this.scene.add(ceilingMesh);

    for (let tz = 0; tz < 28; tz += 9) {
      const trussGeo = new THREE.BoxGeometry(42, 0.45, 0.45);
      const trussMat = new THREE.MeshStandardMaterial({ color: 0x162033, metalness: 0.8, roughness: 0.3 });
      const truss = new THREE.Mesh(trussGeo, trussMat);
      truss.position.set(0, 15.6, tz);
      this.scene.add(truss);
    }
  }

  /* -------------------------------------------------------------
     ENTRANCE LOBBY & INTERACTIVE GATE
  ------------------------------------------------------------- */
  private buildEntranceLobby() {
    const lobbyZ = 32;

    const marbleTex = createMarbleTexture();
    const foyerFloorMat = new THREE.MeshStandardMaterial({
      map: marbleTex,
      roughness: 0.2,
      metalness: 0.2,
    });
    const foyerFloor = new THREE.Mesh(new THREE.PlaneGeometry(26, 20), foyerFloorMat);
    foyerFloor.rotation.x = -Math.PI / 2;
    foyerFloor.position.set(0, 0, lobbyZ + 6);
    this.scene.add(foyerFloor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9e3d4, roughness: 0.6 });

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(9, 10, 0.6), wallMat);
    leftWall.position.set(-7.5, 5, lobbyZ);
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(9, 10, 0.6), wallMat);
    rightWall.position.set(7.5, 5, lobbyZ);
    this.scene.add(rightWall);

    const topWall = new THREE.Mesh(new THREE.BoxGeometry(7, 5.5, 0.6), wallMat);
    topWall.position.set(0, 7.25, lobbyZ);
    this.scene.add(topWall);

    const signTexture = createEntranceSignTexture();
    const signMat = new THREE.MeshBasicMaterial({ map: signTexture });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), signMat);
    signMesh.position.set(0, 6.2, lobbyZ + 0.35);
    this.scene.add(signMesh);

    const doorWidth = 3.0;
    const doorHeight = 4.8;
    const doorThickness = 0.15;

    const doorGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x8b5a2b,
      metalness: 0.0,
      roughness: 0.8,
      // transmission: 0.3,
      // transparent: true,
      // opacity: 0.85,
    });

    this.leftDoorGroup = new THREE.Group();
    this.leftDoorGroup.position.set(-doorWidth, 0, lobbyZ);

    const leftDoorPanel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness), doorGlassMat);
    leftDoorPanel.position.set(doorWidth / 2, doorHeight / 2, 0);
    this.leftDoorGroup.add(leftDoorPanel);

    const handleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
    const leftHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), handleMat);
    leftHandle.position.set(doorWidth - 0.2, 2.0, 0.12);
    this.leftDoorGroup.add(leftHandle);

    const leftSignTex = createDoorSignTexture('PUSH');
    const leftSign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: leftSignTex }));
    leftSign.position.set(doorWidth / 2, 2.8, 0.09);
    this.leftDoorGroup.add(leftSign);

    this.scene.add(this.leftDoorGroup);

    this.rightDoorGroup = new THREE.Group();
    this.rightDoorGroup.position.set(doorWidth, 0, lobbyZ);

    const rightDoorPanel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness), doorGlassMat);
    rightDoorPanel.position.set(-doorWidth / 2, doorHeight / 2, 0);
    this.rightDoorGroup.add(rightDoorPanel);

    const rightHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), handleMat);
    rightHandle.position.set(-doorWidth + 0.2, 2.0, 0.12);
    this.rightDoorGroup.add(rightHandle);

    const rightSignTex = createDoorSignTexture('PUSH');
    const rightSign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: rightSignTex }));
    rightSign.position.set(-doorWidth / 2, 2.8, 0.09);
    this.rightDoorGroup.add(rightSign);

    this.scene.add(this.rightDoorGroup);

    const gateHitboxGeo = new THREE.BoxGeometry(6.0, 5.0, 1.5);
    const gateHitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    this.gateHitbox = new THREE.Mesh(gateHitboxGeo, gateHitboxMat);
    this.gateHitbox.position.set(0, 2.5, lobbyZ);
    this.gateHitbox.userData = { isGate: true };
    this.scene.add(this.gateHitbox);
    this.interactiveObjects.push(this.gateHitbox);

    const beaconGeo = new THREE.RingGeometry(1.5, 1.8, 32);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.rotation.x = -Math.PI / 2;
    beacon.position.set(0, 0.04, lobbyZ + 4);
    this.scene.add(beacon);

    gsap.to(beacon.scale, {
      x: 1.25,
      y: 1.25,
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }

  /* -------------------------------------------------------------
     3D CONTIGUOUS AUDITORIUM SEATS
  ------------------------------------------------------------- */
  private buildSeatingArea(seats: SeatData[]) {
    const seatBaseGeo = new THREE.BoxGeometry(0.56, 0.12, 0.50);
    const seatBackCushionGeo = new THREE.BoxGeometry(0.54, 0.66, 0.08);
    const seatBackWoodGeo = new THREE.BoxGeometry(0.56, 0.70, 0.04);
    const armrestMetalGeo = new THREE.BoxGeometry(0.06, 0.32, 0.44);
    const armrestWoodCapGeo = new THREE.BoxGeometry(0.08, 0.04, 0.46);
    const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.38, 8);
    const aisleEndPanelGeo = new THREE.BoxGeometry(0.08, 0.65, 0.52);

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5c3822,
      roughness: 0.35,
      metalness: 0.05,
    });

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.25,
    });

    const markerLedMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

    seats.forEach((seat) => {
      const seatGroup = new THREE.Group();
      seatGroup.position.set(seat.position.x, seat.position.y, seat.position.z);
      seatGroup.rotation.set(seat.rotation.x, seat.rotation.y, seat.rotation.z);

      this.seatPositions.set(seat.id, new THREE.Vector3(seat.position.x, seat.position.y, seat.position.z));

      let cushionColor = 0x162f52;
      if (seat.tier === 'VIP') cushionColor = 0x122744;
      if (seat.status === 'occupied') cushionColor = 0x243242;

      const cushionMat = new THREE.MeshStandardMaterial({
        color: cushionColor,
        roughness: 0.65,
        metalness: 0.1,
      });

      const baseCushion = new THREE.Mesh(seatBaseGeo, cushionMat);
      baseCushion.position.set(0, 0.40, 0);
      baseCushion.castShadow = true;
      seatGroup.add(baseCushion);

      const backrestWood = new THREE.Mesh(seatBackWoodGeo, woodMat);
      backrestWood.position.set(0, 0.72, -0.22);
      backrestWood.rotation.x = -0.11;
      backrestWood.castShadow = true;
      seatGroup.add(backrestWood);

      const backrestCushion = new THREE.Mesh(seatBackCushionGeo, cushionMat);
      backrestCushion.position.set(0, 0.72, -0.17);
      backrestCushion.rotation.x = -0.11;
      backrestCushion.castShadow = true;
      seatGroup.add(backrestCushion);

      const createArmrest = (xPos: number) => {
        const armGroup = new THREE.Group();
        armGroup.position.set(xPos, 0.52, -0.04);
        armGroup.add(new THREE.Mesh(armrestMetalGeo, metalMat));
        const woodCap = new THREE.Mesh(armrestWoodCapGeo, woodMat);
        woodCap.position.set(0, 0.16, 0);
        armGroup.add(woodCap);
        return armGroup;
      };

      seatGroup.add(createArmrest(-0.29));
      seatGroup.add(createArmrest(0.29));

      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(0, 0.19, 0);
      seatGroup.add(leg);

      if (seat.number === 1 || seat.number === 14 || seat.number === 15) {
        const isLeftAisle = seat.number === 1;
        const endPanel = new THREE.Mesh(aisleEndPanelGeo, woodMat);
        endPanel.position.set(isLeftAisle ? -0.32 : 0.32, 0.52, -0.04);
        seatGroup.add(endPanel);

        const led = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8), markerLedMat);
        led.position.set(isLeftAisle ? -0.37 : 0.37, 0.65, 0.1);
        led.rotation.z = Math.PI / 2;
        seatGroup.add(led);
      }

      this.scene.add(seatGroup);
      this.seatMeshes.set(seat.id, seatGroup);
    });

    // Active Selection Beacon Ring
    const activeRingGeo = new THREE.RingGeometry(0.4, 0.55, 32);
    const activeRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
    });
    this.activeBeaconRing = new THREE.Mesh(activeRingGeo, activeRingMat);
    this.activeBeaconRing.rotation.x = -Math.PI / 2;
    this.activeBeaconRing.position.set(0, 0.05, 0);
    this.scene.add(this.activeBeaconRing);

    this.updateActivePovVisual(this.currentPov);
  }

  /* -------------------------------------------------------------
     UPDATE POV VISUAL HIGHLIGHTS & ZERO HINDRANCE
  ------------------------------------------------------------- */
  private updateActivePovVisual(pov: PovPosition) {
    const config = POV_PRESETS[pov];
    if (!config || !this.activeBeaconRing) return;

    this.activeBeaconRing.position.set(config.position.x, 0.1, config.position.z);

    // In SEATED POV mode:
    // 1. Hide the floor riser platforms that create horizontal brown strips across the screen
    // 2. Hide any foreground chairs in line of sight
    if (this.currentState === 'SEATED' || this.currentState === 'CHANGING_SEAT') {
      // Hide all tiered platform strips in front of screen for 100% crystal-clear view
      this.tierMeshes.forEach((mesh) => {
        mesh.visible = false;
      });

      const povX = config.position.x;
      const povZ = config.position.z;

      this.seatMeshes.forEach((group, seatId) => {
        const pos = this.seatPositions.get(seatId);
        if (!pos) return;

        const dist = Math.sqrt((pos.x - povX) ** 2 + (pos.z - povZ) ** 2);
        const isInForeground = pos.z < povZ + 1.5 && Math.abs(pos.x - povX) < 5.0;

        if (dist < 3.5 || isInForeground) {
          group.visible = false;
        } else {
          group.visible = true;
        }
      });
    } else {
      // In Overview and Lobby: restore all tier platforms and chairs for full architectural 3D view
      this.tierMeshes.forEach((mesh) => {
        mesh.visible = true;
      });

      this.seatMeshes.forEach((group) => {
        group.visible = true;
      });
    }
  }

  /* -------------------------------------------------------------
     CINEMATIC FLOW: GATE OPEN & ENTER AUDITORIUM (90% SCREEN IMMERSION)
  ------------------------------------------------------------- */
  public enterAuditorium(targetPov: PovPosition = 'CENTER', onComplete?: () => void) {
    this.currentState = 'ENTERING';
    this.callbacks.onStateChange('ENTERING');

    this.currentPov = targetPov;
    const config = POV_PRESETS[targetPov];

    const tl = gsap.timeline({
      onComplete: () => {
        this.currentState = 'SEATED';
        this.callbacks.onStateChange('SEATED');
        this.updateActivePovVisual(targetPov);
        this.callbacks.onPovChange(targetPov);
        if (onComplete) onComplete();
      },
    });

    // 1. Swing open doors
    tl.to(this.leftDoorGroup.rotation, { y: Math.PI * 0.45, duration: 1.2, ease: 'power2.inOut' }, 0);
    tl.to(this.rightDoorGroup.rotation, { y: -Math.PI * 0.45, duration: 1.2, ease: 'power2.inOut' }, 0);

    // 2. Camera Moves through doors
    tl.to(
      this.camera.position,
      {
        x: 0,
        y: 3.5,
        z: 20,
        duration: 1.8,
        ease: 'power1.inOut',
      },
      0.4
    );

    // Look straight-on at presentation screen center
    tl.to(
      this.currentLookAt,
      {
        x: config.lookAt.x,
        y: config.lookAt.y,
        z: config.lookAt.z,
        duration: 2.0,
        ease: 'power1.out',
      },
      0.4
    );

    // 3. Move smoothly down aisle
    tl.to(
      this.camera.position,
      {
        x: config.position.x * 0.5,
        y: config.position.y,
        z: config.position.z + 3.5,
        duration: 1.8,
        ease: 'power2.inOut',
      },
      2.0
    );

    // 4. Glide directly into target POV with 90% screen framing
    tl.to(
      this.camera.position,
      {
        x: config.position.x,
        y: config.position.y,
        z: config.position.z,
        duration: 1.4,
        ease: 'power2.out',
      },
      3.6
    );
  }

  /* -------------------------------------------------------------
     SWITCH BETWEEN 3 BEST SEAT POVS (LEFT, CENTER, RIGHT)
  ------------------------------------------------------------- */
  public switchPov(newPov: PovPosition, onComplete?: () => void) {
    if (this.currentState === 'ENTERING') return;

    this.currentPov = newPov;
    const config = POV_PRESETS[newPov];
    if (!config) return;

    this.currentState = 'CHANGING_SEAT';
    this.callbacks.onStateChange('CHANGING_SEAT');
    this.updateActivePovVisual(newPov);

    // Smoothly glide camera from current POV to target POV in 1.1s
    gsap.to(this.camera.position, {
      x: config.position.x,
      y: config.position.y,
      z: config.position.z,
      duration: 1.1,
      ease: 'power2.inOut',
      onComplete: () => {
        this.currentState = 'SEATED';
        this.callbacks.onStateChange('SEATED');
        this.updateActivePovVisual(newPov);
        this.callbacks.onPovChange(newPov);
        if (onComplete) onComplete();
      },
    });

    // Align gaze directly straight-on at presentation screen
    gsap.to(this.currentLookAt, {
      x: config.lookAt.x,
      y: config.lookAt.y,
      z: config.lookAt.z,
      duration: 1.1,
      ease: 'power2.inOut',
    });
  }

  /* -------------------------------------------------------------
     SET CAMERA VIEW MODES (POV, OVERVIEW, LOBBY)
  ------------------------------------------------------------- */
  public setViewMode(mode: 'POV' | 'OVERVIEW' | 'LOBBY') {
    if (this.currentState === 'ENTERING') return;

    if (mode === 'POV') {
      this.switchPov(this.currentPov);
    } else if (mode === 'OVERVIEW') {
      this.currentState = 'OVERVIEW';
      this.callbacks.onStateChange('OVERVIEW');
      this.updateActivePovVisual(this.currentPov);

      gsap.to(this.camera.position, {
        x: 0,
        y: 16.0,
        z: 26,
        duration: 1.6,
        ease: 'power2.inOut',
      });
      gsap.to(this.currentLookAt, {
        x: 0,
        y: 4.5,
        z: 0,
        duration: 1.6,
        ease: 'power2.inOut',
      });
    } else if (mode === 'LOBBY') {
      this.currentState = 'LOBBY';
      this.callbacks.onStateChange('LOBBY');
      this.updateActivePovVisual(this.currentPov);

      // Close doors
      gsap.to(this.leftDoorGroup.rotation, { y: 0, duration: 1.0 });
      gsap.to(this.rightDoorGroup.rotation, { y: 0, duration: 1.0 });

      gsap.to(this.camera.position, {
        x: 0,
        y: 2.2,
        z: 38,
        duration: 1.6,
        ease: 'power2.inOut',
      });
      gsap.to(this.currentLookAt, {
        x: 0,
        y: 2.2,
        z: 30,
        duration: 1.6,
        ease: 'power2.inOut',
      });
    }
  }

  /* -------------------------------------------------------------
     LIGHTING PRESETS
  ------------------------------------------------------------- */
  public setLightingMode(mode: 'PRESENTATION' | 'HOUSE' | 'CYBER') {
    if (mode === 'PRESENTATION') {
      gsap.to(this.ambientLight, { intensity: 0.75, duration: 1 });
      gsap.to(this.houseLight, { intensity: 0.35, duration: 1 });
      gsap.to(this.stageSpot1, { intensity: 5.5, duration: 1 });
      gsap.to(this.stageSpot2, { intensity: 5.0, duration: 1 });
    } else if (mode === 'HOUSE') {
      gsap.to(this.ambientLight, { intensity: 1.4, duration: 1 });
      gsap.to(this.houseLight, { intensity: 1.2, duration: 1 });
      gsap.to(this.stageSpot1, { intensity: 3.0, duration: 1 });
      gsap.to(this.stageSpot2, { intensity: 3.0, duration: 1 });
    } else if (mode === 'CYBER') {
      gsap.to(this.ambientLight, { intensity: 0.45, duration: 1 });
      gsap.to(this.houseLight, { intensity: 0.15, duration: 1 });
      gsap.to(this.stageSpot1, { intensity: 7.5, duration: 1 });
      gsap.to(this.stageSpot2, { intensity: 7.5, duration: 1 });
    }
  }

  /* -------------------------------------------------------------
     INTERACTION & POINTER EVENTS (GATE ONLY IN LOBBY)
  ------------------------------------------------------------- */
  private onPointerMove(event: MouseEvent) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Subtle head-turn parallax when seated
    if (this.currentState === 'SEATED' && this.isMouseLooking) {
      this.mouseOffset.x = this.mouse.x * 0.3;
      this.mouseOffset.y = this.mouse.y * 0.15;
    } else {
      this.mouseOffset.x = 0;
      this.mouseOffset.y = 0;
    }

    if (this.currentState === 'LOBBY') {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);
      if (intersects.length > 0 && intersects[0].object.userData.isGate) {
        document.body.style.cursor = 'pointer';
        this.callbacks.onGateHover(true);
        return;
      }
    }

    document.body.style.cursor = 'default';
    this.callbacks.onGateHover(false);
  }

  private onClick(event: MouseEvent) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    if (this.currentState === 'LOBBY') {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);
      if (intersects.length > 0 && intersects[0].object.userData.isGate) {
        this.enterAuditorium('CENTER');
      }
    }
  }

  private onWindowResize() {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /* -------------------------------------------------------------
     RENDER LOOP
  ------------------------------------------------------------- */
  private animate() {
    if (this.isDestroyed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    const lookTarget = new THREE.Vector3(
      this.currentLookAt.x + this.mouseOffset.x * 1.2,
      this.currentLookAt.y + this.mouseOffset.y * 0.6,
      this.currentLookAt.z
    );

    this.camera.lookAt(lookTarget);

    if (this.activeBeaconRing) {
      this.activeBeaconRing.rotation.z += 0.015;
    }

    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('click', this.onClick);

    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
