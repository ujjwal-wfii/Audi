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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

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
    position: new THREE.Vector3(-3.2, 7.0, 15.5),
    lookAt: new THREE.Vector3(0.4, 7.0, -8.5),
    associatedSeatId: 'C-3',
  },
  CENTER: {
    id: 'CENTER',
    name: 'Center VIP Sweet-Spot POV',
    badge: 'Center Sweet-Spot • 90% Screen Immersion',
    description: 'Prime central direct presentation view with 90% screen viewport occupancy',
    position: new THREE.Vector3(0, 7.0, 15.2),
    lookAt: new THREE.Vector3(0, 7.0, -8.5),
    associatedSeatId: 'C-10',
  },
  RIGHT: {
    id: 'RIGHT',
    name: 'Right VIP Seat POV',
    badge: 'Right VIP • 90% Screen Immersion',
    description: 'Direct straight-on frontal presentation view with 90% screen viewport occupancy',
    position: new THREE.Vector3(3.2, 7.0, 15.5),
    lookAt: new THREE.Vector3(-0.4, 7.0, -8.5),
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
  private cssRenderer: CSS3DRenderer;
  private youtubeScreen: CSS3DObject | null = null;
  private presenterScreen: CSS3DObject | null = null;
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
  // Observes the actual canvas/container size.
  // More reliable than relying only on window resize events.
  private resizeObserver: ResizeObserver | null = null;
  private readonly referenceAspect = 16 / 9;
  private readonly referenceFov = 60;

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
    this.camera = new THREE.PerspectiveCamera(this.referenceFov, width / height, 0.05, 200);
    // Initial camera in Lobby
    this.camera.position.set(0, 2.2, 38);
    this.currentLookAt.set(0, 2.2, 30);
    this.camera.lookAt(this.currentLookAt);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // -------------------------------------------------------------
    // CSS3D RENDERER FOR YOUTUBE VIDEO ON THE 3D SCREEN
    // -------------------------------------------------------------
    this.cssRenderer = new CSS3DRenderer();

    this.cssRenderer.setSize(width, height);

    this.cssRenderer.domElement.style.position = 'absolute';
    this.cssRenderer.domElement.style.top = '0';
    this.cssRenderer.domElement.style.left = '0';
    this.cssRenderer.domElement.style.width = '100%';
    this.cssRenderer.domElement.style.height = '100%';
    this.cssRenderer.domElement.style.pointerEvents = 'none';
    this.cssRenderer.domElement.style.zIndex = '1';

    this.container.appendChild(this.cssRenderer.domElement);

    // Keep WebGL behind/alongside the CSS3D layer.
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.zIndex = '0';
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
    // Watch the actual Three.js container.
    // This catches layout changes caused by responsive CSS,
    // including changes that may not come through as a normal
    // window resize event.
    this.resizeObserver = new ResizeObserver(() => {
      this.onWindowResize();
    });

    this.resizeObserver.observe(this.container);

    // Start loop
    this.animate = this.animate.bind(this);
    this.animate();
  }

  /* -------------------------------------------------------------
     LIGHTING SETUP
  ------------------------------------------------------------- */
  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xfff4e6,
      1.15);
    this.scene.add(this.ambientLight);

    this.houseLight = new THREE.DirectionalLight(0xffe8cc,
      1.1);
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
    // const stageBlueLight = new THREE.PointLight(0x0284c7, 4.0, 25);
    // stageBlueLight.position.set(0, 2.5, -7.5);
    // this.scene.add(stageBlueLight);

    // Entrance Gate Downlight
    const lobbyLight = new THREE.PointLight(0x60a5fa, 3.0, 18);
    lobbyLight.position.set(0, 4.5, 36);
    this.scene.add(lobbyLight);
  }
  // -------------------------------------------------------------
  // YOUTUBE LIVE VIDEO ON THE REAL 3D SCREEN
  // -------------------------------------------------------------
  private createYouTubeScreen() {
    const screenWidth = 28;
    const screenHeight = 13;


    const youtubeVideoId = 'WjSNkTVHB88';

    const wrapper = document.createElement('div');

    // Large CSS canvas which gets scaled into Three.js world units.
    const cssWidth = 1000;
    const cssHeight = cssWidth * (screenHeight / screenWidth);

    wrapper.style.width = `${cssWidth}px`;
    wrapper.style.height = `${cssHeight}px`;
    wrapper.style.background = '#000';
    wrapper.style.overflow = 'hidden';
    wrapper.style.border = '20px solid #5c3822';
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.borderRadius = '18px';
    wrapper.style.pointerEvents = 'none';

    const iframe = document.createElement('iframe');

    iframe.src =
      `https://www.youtube.com/embed/${youtubeVideoId}` +
      `?autoplay=1` +
      `&controls=0` +
      `&rel=0` +
      `&modestbranding=1` +
      `&playsinline=1`;

    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.pointerEvents = 'none';

    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.setAttribute('allowfullscreen', '');

    wrapper.appendChild(iframe);

    const videoObject = new CSS3DObject(wrapper);

    // Match the exact position of your existing physical screen.
    videoObject.position.set(
      0,
      screenHeight / 2,
      -8.49
    );

    videoObject.rotation.set(0, 0, 0);

    // Convert the 1000px CSS element into the same
    // 28 x 13 Three.js dimensions as the real screen.
    const worldScale = screenWidth / cssWidth;

    videoObject.scale.set(
      worldScale,
      worldScale,
      worldScale
    );

    this.youtubeScreen = videoObject;

    this.scene.add(videoObject);
  }
  private createPresenterScreen() {
    // -------------------------------------------------------------
    // VERTICAL PRESENTER SCREEN
    // Replaces the podium
    // -------------------------------------------------------------

    const screenWidth = 4;
    const screenHeight = 7.1111; // 9:16 portrait ratio
    const stageHeight = 1.2;

    // Replace this later with the second YouTube Live video ID
    const presenterVideoId = 'yZrV-5vvZSE';

    const wrapper = document.createElement('div');

    // CSS3D uses pixel dimensions, then we scale it into world space.
    const cssWidth = 500;
    const cssHeight = 888.89;

    wrapper.style.width = `${cssWidth}px`;
    wrapper.style.height = `${cssHeight}px`;
    wrapper.style.background = '#000';
    wrapper.style.overflow = 'hidden';
    wrapper.style.border = '20px solid #5c3822';
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.borderRadius = '18px';
    wrapper.style.pointerEvents = 'none';

    const iframe = document.createElement('iframe');

    iframe.src =
      `https://www.youtube.com/embed/${presenterVideoId}` +
      `?autoplay=1` +
      `&controls=0` +
      `&rel=0` +
      `&modestbranding=1` +
      `&playsinline=1`;

    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.pointerEvents = 'none';

    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.setAttribute('allowfullscreen', '');

    wrapper.appendChild(iframe);

    const presenterScreen = new CSS3DObject(wrapper);

    // -------------------------------------------------------------
    // PODIUM LOCATION
    // -------------------------------------------------------------
    const podiumX = -11.0;
    const podiumZ = -0.5;

    // Bottom of screen sits directly on the stage
    presenterScreen.position.set(
      podiumX,
      stageHeight + screenHeight / 2,
      podiumZ
    );

    // Face the audience
    presenterScreen.rotation.set(0, 0, 0);

    // Convert CSS pixels into Three.js world units
    const worldScale = screenWidth / cssWidth;

    presenterScreen.scale.set(
      worldScale,
      worldScale,
      worldScale
    );

    this.presenterScreen = presenterScreen;

    this.scene.add(presenterScreen);
  }
  // -------------------------------------------------------------
  // CHECK WHETHER THE 3D AUDITORIUM SCREEN IS VISIBLE
  // -------------------------------------------------------------
  private isScreenVisibleFromCamera(): boolean {
    if (!this.screenMesh) return false;

    const cameraPosition = this.camera.getWorldPosition(
      new THREE.Vector3()
    );

    // Physical screen dimensions.
    const screenWidth = 28;
    const screenHeight = 13;

    // Five points across the screen:
    // center + four corners slightly inside the edges.
    const screenPoints = [
      new THREE.Vector3(0, 0, 0),

      new THREE.Vector3(
        -screenWidth * 0.42,
        screenHeight * 0.42,
        0
      ),

      new THREE.Vector3(
        screenWidth * 0.42,
        screenHeight * 0.42,
        0
      ),

      new THREE.Vector3(
        -screenWidth * 0.42,
        -screenHeight * 0.42,
        0
      ),

      new THREE.Vector3(
        screenWidth * 0.42,
        -screenHeight * 0.42,
        0
      ),
    ];

    let visiblePoints = 0;

    for (const localPoint of screenPoints) {
      // Convert the screen point from local coordinates
      // into actual world coordinates.
      const worldPoint = localPoint.clone();

      this.screenMesh.localToWorld(worldPoint);

      const direction = worldPoint
        .clone()
        .sub(cameraPosition)
        .normalize();

      const distanceToScreen =
        cameraPosition.distanceTo(worldPoint);

      this.raycaster.set(cameraPosition, direction);

      const intersections =
        this.raycaster.intersectObjects(
          this.scene.children,
          true
        );

      let blocked = false;

      for (const hit of intersections) {
        // Ignore the physical screen.
        if (
          hit.object === this.screenMesh ||
          hit.object.parent === this.screenMesh
        ) {
          continue;
        }

        // Ignore anything that isn't actually closer
        // than the screen point we're testing.
        if (hit.distance < distanceToScreen - 0.1) {
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        visiblePoints++;
      }
    }

    // Show the video when at least 2 of the 5 screen points
    // can actually be seen by the camera.
    return visiblePoints >= 2;
  }
  // -------------------------------------------------------------
  // CHECK WHETHER THE VERTICAL PRESENTER SCREEN IS VISIBLE
  // -------------------------------------------------------------
  private isPresenterScreenVisibleFromCamera(): boolean {
    if (!this.presenterScreen) return false;

    const cameraPosition = this.camera.getWorldPosition(
      new THREE.Vector3()
    );

    // Vertical presenter screen dimensions.
    const screenWidth = 5;
    const screenHeight = 8.8889;

    // Center + four points slightly inside the edges.
    const screenPoints = [
      new THREE.Vector3(0, 0, 0),

      new THREE.Vector3(
        -screenWidth * 0.42,
        screenHeight * 0.42,
        0
      ),

      new THREE.Vector3(
        screenWidth * 0.42,
        screenHeight * 0.42,
        0
      ),

      new THREE.Vector3(
        -screenWidth * 0.42,
        -screenHeight * 0.42,
        0
      ),

      new THREE.Vector3(
        screenWidth * 0.42,
        -screenHeight * 0.42,
        0
      ),
    ];

    let visiblePoints = 0;

    for (const localPoint of screenPoints) {
      const worldPoint = localPoint.clone();

      this.presenterScreen.localToWorld(worldPoint);

      const direction = worldPoint
        .clone()
        .sub(cameraPosition)
        .normalize();

      const distanceToScreen =
        cameraPosition.distanceTo(worldPoint);

      this.raycaster.set(cameraPosition, direction);

      const intersections =
        this.raycaster.intersectObjects(
          this.scene.children,
          true
        );

      let blocked = false;

      for (const hit of intersections) {
        // Ignore the presenter screen itself.
        if (
          hit.object === this.presenterScreen ||
          hit.object.parent === this.presenterScreen
        ) {
          continue;
        }

        if (hit.distance < distanceToScreen - 0.1) {
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        visiblePoints++;
      }
    }

    return visiblePoints >= 2;
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
    const stageDepth = 20;

    const stageMaterial = new THREE.MeshStandardMaterial({
      map: woodTexture,
      roughness: 0.25,
      metalness: 0.15,
    });

    const stageGeo = new THREE.BoxGeometry(
      stageWidth,
      stageHeight,
      stageDepth
    );
    const stage = new THREE.Mesh(stageGeo, stageMaterial);
    // stage.rotation.y = -Math.PI / 2;
    stage.position.set(STAGE_CENTER.x, stageHeight / 2, -7.5);
    stage.receiveShadow = true;
    this.scene.add(stage);

    // 2. Large Curved Keynote Screen (90% Viewport Occupancy, Center at Y = 5.0, Z = -8.5)
    // const screenHeight = 13.0;
    // const screenRadius = 18;
    // const screenArc = 1.45; // ~83 degree wide immersive panoramic screen

    // const screenGeo = new THREE.CylinderGeometry(
    //   screenRadius,
    //   screenRadius,
    //   screenHeight,
    //   64,
    //   1,
    //   true,
    //   -screenArc / 2,
    //   screenArc
    // );

    // const screenTexture = createKeynoteScreenTexture();
    // screenTexture.wrapS = THREE.RepeatWrapping;
    // screenTexture.repeat.set(-1, 1);
    // screenTexture.center.set(0.5, 0.5);
    // screenTexture.needsUpdate = true;

    // const screenMat = new THREE.MeshBasicMaterial({
    //   map: screenTexture,
    //   side: THREE.DoubleSide,
    // });

    // this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    // // Positioned directly at frontal eye-level Y = 5.0, Z = -8.5
    // this.screenMesh.position.set(0, 6.5, -8.5);
    // this.screenMesh.rotation.y = Math.PI;
    // this.scene.add(this.screenMesh);
    const screenWidth = 28;
    const screenHeight = 13;

    const screenGeo = new THREE.PlaneGeometry(
      screenWidth,
      screenHeight
    );

    const screenTexture = createKeynoteScreenTexture();
    // screenTexture.wrapS = THREE.RepeatWrapping;
    // screenTexture.repeat.set(1, 1);
    screenTexture.center.set(0.5, 0.5);
    screenTexture.needsUpdate = true;

    const screenMat = new THREE.MeshBasicMaterial({
      map: screenTexture,
      side: THREE.DoubleSide,
    });

    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);

    // Vertical rectangular screen
    // Bottom = 0, top = 13
    this.screenMesh.position.set(0, screenHeight / 2, -8.5);

    this.screenMesh.rotation.y = 0;

    this.scene.add(this.screenMesh);

    this.createYouTubeScreen();

    const backWallZ = -11;
    const backWallMat = new THREE.MeshStandardMaterial({
      color: 0xD6C7B0,
      roughness: 0.85,
      metalness: 0.1,
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(50, 24, 1.0), backWallMat);
    backWall.position.set(0, 12, backWallZ);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Side "return" walls that close the gap between the proscenium and the
    // rear wall, so there's no visible gap/void at a grazing viewing angle.
    const wingReturnMat = new THREE.MeshStandardMaterial({ color: 0xD6C7B0, roughness: 0.8 });
    const wingDepth = 7; // fixed depth — plenty to close the gap regardless of screen geometry
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 24, wingDepth), wingReturnMat);
      wing.position.set(side * 24, 12, backWallZ + wingDepth / 2 + 0.5);
      this.scene.add(wing);
    }

    // 3. Stage Speaker Podium / Lectern
    // const loader = new GLTFLoader();
    // loader.load('/models/Untitled.glb', (gltf) => {
    //   const podium = gltf.scene;
    //   podium.scale.setScalar(0.8);

    //   podium.position.set(-9.5, stageHeight, -0.5);
    //   podium.rotation.y = 1;

    //   podium.traverse((child) => {
    //     if (child instanceof THREE.Mesh) {
    //       child.material = new THREE.MeshStandardMaterial({
    //         color: 0x5c3822,
    //         roughness: 0.45,
    //         metalness: 0.05,
    //       });
    //     }
    //   });

    //   this.scene.add(podium);
    // });
    this.createPresenterScreen();
    // =========================
    // Plants beside the screen
    // =========================
    const plantLoader = new GLTFLoader();

    plantLoader.load(
      '/models/plant.glb',
      (gltf) => {

        const plantSource = gltf.scene;

        const addPlant = (x: number, y: number, z: number) => {
          const plant = plantSource.clone(true);

          // Position
          plant.position.set(x, y, z);

          // Make it clearly visible for testing
          plant.scale.setScalar(7);

          plant.rotation.y = 0;

          // Make sure the model is visible
          plant.visible = true;

          plant.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.visible = true;
              child.castShadow = true;
              child.receiveShadow = true;

              if (child.material) {
                child.material.transparent = false;
                child.material.opacity = 1;
              }
            }
          });

          this.scene.add(plant);
        };

        // Left and right of screen
        addPlant(-17, 3.5, -7);
        addPlant(17, 3.5, -7);
        addPlant(-22, 3.5, -1);
        addPlant(22, 3.5, -1);
      },
      undefined,
      (error) => {
        console.error('PLANT GLB FAILED TO LOAD:', error);
      }
    );
    //Adding Sofa in front of stage
    const sofaLoader = new GLTFLoader();

    sofaLoader.load(
      '/models/sofa.glb',
      (gltf) => {
        const sofaSource = gltf.scene;
        const addSofa = (x: number, y: number, z: number) => {
          const sofa = sofaSource.clone(true);
          // Position
          sofa.position.set(x, y, z);
          // Size
          sofa.scale.setScalar(5);
          // Rotation
          sofa.rotation.y = Math.PI;
          // Make sure the model is visible
          sofa.visible = true;
          sofa.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.visible = true;
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.transparent = false;
                child.material.opacity = 1;
              }
            }
          });

          this.scene.add(sofa);
        };

        // five sofas in front of the stage
        addSofa(-10, 1.5, 7.5);
        addSofa(-5, 1.5, 7.5);
        addSofa(0, 1.5, 7.5);
        addSofa(5, 1.5, 7.5);
        addSofa(10, 1.5, 7.5);
      },
      undefined,
      (error) => {
        console.error('SOFA GLB FAILED TO LOAD:', error);
      }
    );
    // const podiumGeo = new THREE.BoxGeometry(1.2, 4.2, 0.8);
    // const podiumMat = new THREE.MeshStandardMaterial({ color: 0xD6C7B0, roughness: 0.2, metalness: 0.7 });
    // const podium = new THREE.Mesh(podiumGeo, podiumMat);
    // podium.position.set(-8.5, stageHeight + 0.62, -4.5);
    // podium.rotation.y = 0.5;
    // this.scene.add(podium);

    // 4. Acoustic Wooden Slat Side Walls
    const wallBeigeMat = new THREE.MeshStandardMaterial({
      color: 0xD6C7B0,
      roughness: 0.75,
      metalness: 0.0,
    });
    // Decorative wooden wall fins — dark warm wood
    const wallFinWoodMat = new THREE.MeshStandardMaterial({
      color: 0x5A3824,
      roughness: 0.55,
      metalness: 0.05,
    });

    const sconceGlowMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

    for (const side of [-1, 1]) {
      const wallGeo = new THREE.BoxGeometry(0.6, 18, 46);
      const wall = new THREE.Mesh(wallGeo, wallBeigeMat);
      wall.position.set(side * 24, 9, 10);
      wall.rotation.y = side * -0.07;
      this.scene.add(wall);

      for (let i = 0; i < 9; i++) {
        const finGeo = new THREE.BoxGeometry(0.35, 12, 1.4);
        const fin = new THREE.Mesh(finGeo, wallFinWoodMat);
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
    // const tierCarpetMat = new THREE.MeshStandardMaterial({
    //   map: carpetTex,
    //   roughness: 0.85,
    // });

    // 5. Tiered Stepped Floor Risers (STORED IN tierMeshes SO WE CAN HIDE THEM IN POV MODE TO PREVENT ANY STRIPS IN FRONT OF SCREEN)
    const tierCarpetMat = new THREE.MeshStandardMaterial({
      map: carpetTex,
      roughness: 0.85,
    });

    const tierFrontMat = new THREE.MeshStandardMaterial({
      color: 0x6b4f2a,
      roughness: 0.6,
    });

    const stepAmberMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
    });

    // Same values as the new straight seat layout
    const seatingWidth = 35.0;
    const rowDepth = 2.2;
    const firstRowZ = 10.0;

    ROW_CONFIGS.forEach((rowConfig, idx) => {
      const { elevation } = rowConfig;

      const z = firstRowZ + idx * rowDepth;

      // Height difference from the previous row
      const fasciaHeight =
        idx === 0
          ? elevation
          : elevation - ROW_CONFIGS[idx - 1].elevation;

      // --------------------------------
      // ROW PLATFORM
      // --------------------------------

      const platformGeo = new THREE.BoxGeometry(
        seatingWidth,
        0.15,
        rowDepth
      );

      const platformMesh = new THREE.Mesh(
        platformGeo,
        tierCarpetMat
      );

      platformMesh.position.set(
        STAGE_CENTER.x,
        elevation - 0.075,
        z
      );

      platformMesh.receiveShadow = true;

      this.scene.add(platformMesh);
      this.tierMeshes.push(platformMesh);

      // --------------------------------
      // FRONT OF STEP / RISER
      // --------------------------------

      if (fasciaHeight > 0) {
        const fasciaGeo = new THREE.BoxGeometry(
          seatingWidth,
          fasciaHeight,
          0.12
        );

        const fasciaMesh = new THREE.Mesh(
          fasciaGeo,
          tierFrontMat
        );

        fasciaMesh.position.set(
          STAGE_CENTER.x,
          elevation - fasciaHeight / 2,
          z - rowDepth / 2
        );

        fasciaMesh.castShadow = true;
        fasciaMesh.receiveShadow = true;

        this.scene.add(fasciaMesh);
        this.tierMeshes.push(fasciaMesh);
      }

      // --------------------------------
      // CENTER AISLE STEP LIGHT
      // --------------------------------

      const aisleStepGeo = new THREE.BoxGeometry(
        1.6,
        0.04,
        0.12
      );

      const aisleStepLight = new THREE.Mesh(
        aisleStepGeo,
        stepAmberMat
      );

      aisleStepLight.position.set(
        0,
        elevation + 0.02,
        z - rowDepth / 2
      );

      this.scene.add(aisleStepLight);
      this.tierMeshes.push(aisleStepLight);
    });

    // 6. Solid Flat Ground Floor
    const groundFloorGeo = new THREE.PlaneGeometry(50, 30);
    const groundFloorMesh = new THREE.Mesh(groundFloorGeo, tierCarpetMat);
    groundFloorMesh.rotation.x = -Math.PI / 2;
    groundFloorMesh.position.set(0, 0, 4);
    this.scene.add(groundFloorMesh);

    // 7. white Ceiling with Overhead Spotlights & Architectural Beams
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
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
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.65), signMat);
    signMesh.position.set(0, 4.8, lobbyZ + 0.35);
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

    //   const beaconGeo = new THREE.RingGeometry(1.5, 1.8, 32);
    //   const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    //   const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    //   beacon.rotation.x = -Math.PI / 2;
    //   beacon.position.set(0, 0.04, lobbyZ + 4);
    //   this.scene.add(beacon);

    //   gsap.to(beacon.scale, {
    //     x: 1.25,
    //     y: 1.25,
    //     duration: 1.5,
    //     repeat: -1,
    //     yoyo: true,
    //     ease: 'sine.inOut',
    //   });
  }

  /* -------------------------------------------------------------
     3D CONTIGUOUS AUDITORIUM SEATS
  ------------------------------------------------------------- */
  private buildSeatingArea(seats: SeatData[]) {
    /*
    * NEW PREMIUM AUDITORIUM SEAT
    *
    * Visual-only replacement for the old seat model.
    * Seat positions, rotations, IDs and POV behavior remain unchanged.
    */

    // ---------------------------------------------------------
    // Slightly larger than the previous 0.56m-wide seat
    // ---------------------------------------------------------
    const seatWidth = 0.92;

    // ---------------------------------------------------------
    // Materials
    // ---------------------------------------------------------

    const velvetMat = new THREE.MeshStandardMaterial({
      color: 0x2854a6,
      roughness: 0.88,
      metalness: 0.03,
    });

    const walnutMat = new THREE.MeshStandardMaterial({
      color: 0x241a10,
      roughness: 0.38,
      metalness: 0.12,
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xc9a15a,
      roughness: 0.25,
      metalness: 0.75,
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x151515,
      roughness: 0.4,
      metalness: 0.55,
    });

    const ledMat = new THREE.MeshBasicMaterial({
      color: 0x3fa9ff,
    });

    /*
    * Helper for creating rounded rectangular geometry.
    *
    * This gives the same visual idea as Drei's RoundedBox
    * without changing your native Three.js architecture.
    */
    const createRoundedBox = (
      width: number,
      height: number,
      depth: number,
      radius: number,
      material: THREE.Material,
    ) => {
      const shape = new THREE.Shape();

      const x = -width / 2;
      const y = -height / 2;

      shape.moveTo(x + radius, y);
      shape.lineTo(x + width - radius, y);

      shape.quadraticCurveTo(
        x + width,
        y,
        x + width,
        y + radius,
      );

      shape.lineTo(x + width, y + height - radius);

      shape.quadraticCurveTo(
        x + width,
        y + height,
        x + width - radius,
        y + height,
      );

      shape.lineTo(x + radius, y + height);

      shape.quadraticCurveTo(
        x,
        y + height,
        x,
        y + height - radius,
      );

      shape.lineTo(x, y + radius);

      shape.quadraticCurveTo(
        x,
        y,
        x + radius,
        y,
      );

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: radius * 0.55,
        bevelThickness: radius * 0.55,
        curveSegments: 4,
      });

      geometry.center();

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      return mesh;
    };

    seats.forEach((seat) => {
      // -------------------------------------------------------
      // Preserve existing seat group and transform
      // -------------------------------------------------------

      const seatGroup = new THREE.Group();

      // -------------------------------------------------------
      // FORCE STRAIGHT ROW SEATING
      // Ignore any old curved X/Z positions from seat data.
      // -------------------------------------------------------

      const seatPitch = 1.45;
      const centerAisleHalfWidth = 1.8;
      const seatsPerSide = 10;
      const firstRowZ = 10.0;
      const rowSpacing = 2.2;

      const rowIndex = ROW_CONFIGS.findIndex(
        (rowConfig) => rowConfig.row === seat.row
      );

      const straightZ =
        firstRowZ + rowIndex * rowSpacing;

      let straightX: number;

      if (seat.number <= seatsPerSide) {
        // LEFT SIDE: seats 1-6
        straightX =
          -(centerAisleHalfWidth + seatPitch / 2) -
          (seatsPerSide - 1 - (seat.number - 1)) * seatPitch;
      } else if (seat.number <= seatsPerSide * 2) {
        // RIGHT SIDE: seats 7-12
        straightX = centerAisleHalfWidth + seatPitch / 2 + (seat.number - seatsPerSide - 1) * seatPitch;
      } else {
        // Ignore seats 13 and above
        return;
      }


      seatGroup.position.set(
        straightX,
        seat.position.y,
        straightZ
      );

      // Every seat faces the screen in exactly the same direction.
      seatGroup.rotation.set(0, 0, 0);

      // IMPORTANT:
      // These are required by your existing POV system.
      this.seatPositions.set(
        seat.id,
        new THREE.Vector3(
          straightX,
          seat.position.y,
          straightZ,
        ),
      );

      // -------------------------------------------------------
      // Preserve your existing seat status/tier logic
      // -------------------------------------------------------

      let cushionColor = 0x2854a6;

      const seatVelvetMat = new THREE.MeshStandardMaterial({
        color: cushionColor,
        roughness: 0.88,
        metalness: 0.03,
      });

      // -------------------------------------------------------
      // 1. MAIN SEAT CUSHION
      // -------------------------------------------------------

      const cushion = createRoundedBox(
        seatWidth,
        0.20,
        0.70,
        0.055,
        seatVelvetMat,
      );

      cushion.position.set(
        0,
        0.43,
        0,
      );

      seatGroup.add(cushion);

      // -------------------------------------------------------
      // 2. FRONT BOLSTER
      // -------------------------------------------------------

      const frontBolster = createRoundedBox(
        seatWidth,
        0.075,
        0.10,
        0.035,
        seatVelvetMat,
      );

      frontBolster.position.set(
        0,
        0.375,
        -0.235,
      );

      seatGroup.add(frontBolster);

      // -------------------------------------------------------
      // 3. LARGE ROUNDED BACKREST
      // -------------------------------------------------------

      const backrest = createRoundedBox(
        seatWidth + 0.10,
        1.15,
        0.20,
        0.075,
        seatVelvetMat,
      );

      backrest.position.set(
        0,
        0.995,
        0.225,
      );

      backrest.rotation.x = -0.10;

      seatGroup.add(backrest);

      // -------------------------------------------------------
      // 4. LEFT ARMREST
      // -------------------------------------------------------

      const createArmrest = (xPos: number) => {
        const armGroup = new THREE.Group();

        armGroup.position.set(
          xPos,
          0,
          0,
        );

        // Vertical walnut side panel
        const panel = createRoundedBox(
          0.11,
          0.62,
          0.58,
          0.025,
          walnutMat,
        );

        panel.position.set(
          0,
          0.50,
          0,
        );

        armGroup.add(panel);

        // Rounded top cap
        const topCap = createRoundedBox(
          0.075,
          0.045,
          0.50,
          0.015,
          walnutMat,
        );

        topCap.position.set(
          0,
          0.825,
          0.02,
        );

        armGroup.add(topCap);

        // Thin brass trim
        const brassTrim = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.012,
            0.028,
            0.48,
          ),
          brassMat,
        );

        brassTrim.position.set(
          0.035,
          0.825,
          0.02,
        );

        brassTrim.castShadow = true;

        armGroup.add(brassTrim);

        return armGroup;
      };

      // Slightly wider armrest spacing because the seat itself
      // has been increased.
      const armX = seatWidth / 2 + 0.055;

      seatGroup.add(createArmrest(-armX));
      seatGroup.add(createArmrest(armX));

      // -------------------------------------------------------
      // 5. CENTRAL SUPPORT
      // -------------------------------------------------------

      const support = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.035,
          0.045,
          0.36,
          8,
        ),
        darkMetalMat,
      );

      support.position.set(
        0,
        0.20,
        0,
      );

      support.castShadow = true;

      seatGroup.add(support);

      // -------------------------------------------------------
      // 6. AISLE-END WOOD PANEL + BLUE LED
      //
      // Preserve the existing special treatment for aisle seats.
      // -------------------------------------------------------

      if (seat.number === 1 || seat.number === 7) {
        const isLeftAisle = seat.number === 1;

        const endPanel = createRoundedBox(
          0.11,
          0.65,
          0.52,
          0.025,
          walnutMat,
        );

        endPanel.position.set(
          isLeftAisle ? -0.36 : 0.36,
          0.52,
          -0.04,
        );

        seatGroup.add(endPanel);

        // Small blue aisle indicator
        const led = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.012,
            0.035,
            0.055,
          ),
          ledMat,
        );

        led.position.set(
          isLeftAisle ? -0.405 : 0.405,
          0.66,
          0.10,
        );

        seatGroup.add(led);
      }

      // -------------------------------------------------------
      // Add seat to scene and preserve existing seat map
      // -------------------------------------------------------

      this.scene.add(seatGroup);

      this.seatMeshes.set(
        seat.id,
        seatGroup,
      );
    });

    // ---------------------------------------------------------
    // ACTIVE SELECTION BEACON
    // Keep this exactly as part of the existing POV system.
    // ---------------------------------------------------------

    const activeRingGeo = new THREE.RingGeometry(
      0.4,
      0.55,
      32,
    );

    const activeRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
    });

    this.activeBeaconRing = new THREE.Mesh(
      activeRingGeo,
      activeRingMat,
    );

    this.activeBeaconRing.rotation.x = -Math.PI / 2;

    this.activeBeaconRing.position.set(
      0,
      0.05,
      0,
    );

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

  // added camera aspect for mobile portrait
  private updateCameraForAspect(width: number, height: number) {
    const aspect = width / height;

    // Desktop / landscape: keep the original 54° FOV.
    if (aspect >= this.referenceAspect) {
      this.camera.fov = this.referenceFov;
    } else {
      // On narrower screens, increase vertical FOV
      // so the horizontal composition does not become
      // excessively cropped.
      const referenceHorizontalFov =
        2 *
        Math.atan(
          Math.tan((this.referenceFov * Math.PI) / 360) *
          this.referenceAspect
        );

      const mobileFov =
        (2 *
          Math.atan(
            Math.tan(referenceHorizontalFov / 2) / aspect
          ) *
          180) /
        Math.PI;

      // Avoid extreme fisheye distortion.
      this.camera.fov = Math.min(mobileFov, 110);
    }

    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /* -------------------------------------------------------------
    CINEMATIC FLOW: GATE OPEN & CENTER-AISLE ENTRY
    ------------------------------------------------------------- */
  public enterAuditorium(
    targetPov: PovPosition = 'CENTER',
    onComplete?: () => void
  ) {
    this.currentState = 'ENTERING';
    this.callbacks.onStateChange('ENTERING');

    this.currentPov = targetPov;

    const config = POV_PRESETS[targetPov];

    const aisleStart = new THREE.Vector3(
      0,
      7.0,
      20.0
    );

    const aisleTop = new THREE.Vector3(
      0,
      7.0,
      17.5
    );

    // const aisleMiddle = new THREE.Vector3(
    //   0,
    //   7.0,
    //   16.2
    // );

    // Final destination is the actual selected seat POV
    const finalPosition = config.position;

    const tl = gsap.timeline({
      onComplete: () => {
        this.currentState = 'SEATED';
        this.callbacks.onStateChange('SEATED');

        this.updateActivePovVisual(targetPov);
        this.callbacks.onPovChange(targetPov);

        if (onComplete) {
          onComplete();
        }
      },
    });

    // ---------------------------------------------------------
    // 1. OPEN DOORS
    // ---------------------------------------------------------

    tl.to(
      this.leftDoorGroup.rotation,
      {
        y: Math.PI * 0.45,
        duration: 1.2,
        ease: 'power2.inOut',
      },
      0
    );

    tl.to(
      this.rightDoorGroup.rotation,
      {
        y: -Math.PI * 0.45,
        duration: 1.2,
        ease: 'power2.inOut',
      },
      0
    );

    // ---------------------------------------------------------
    // 2. ENTER THROUGH DOORS
    // ---------------------------------------------------------

    tl.to(
      this.camera.position,
      {
        x: aisleStart.x,
        y: aisleStart.y,
        z: aisleStart.z,
        duration: 1.4,
        ease: 'power2.inOut',
      },
      0.5
    );

    // Look toward the screen
    tl.to(
      this.currentLookAt,
      {
        x: config.lookAt.x,
        y: config.lookAt.y,
        z: config.lookAt.z,
        duration: 1.4,
        ease: 'power2.out',
      },
      0.5
    );

    // ---------------------------------------------------------
    // 3. MOVE INTO TOP OF CENTER AISLE
    // ---------------------------------------------------------

    tl.to(
      this.camera.position,
      {
        x: aisleTop.x,
        y: aisleTop.y,
        z: aisleTop.z,
        duration: 1.2,
        ease: 'power2.inOut',
      },
      1.9
    );

    // ---------------------------------------------------------
    // 4. DESCEND THROUGH CENTER AISLE
    // ---------------------------------------------------------

    // tl.to(
    //   this.camera.position,
    //   {
    //     x: aisleMiddle.x,
    //     y: aisleMiddle.y,
    //     z: aisleMiddle.z,
    //     duration: 1.2,
    //     ease: 'power2.inOut',
    //   },
    //   3.1
    // );

    // ---------------------------------------------------------
    // 5. FINAL MOVE → CENTER SEATING POSITION
    // ---------------------------------------------------------

    tl.to(
      this.camera.position,
      {
        x: finalPosition.x,
        y: finalPosition.y,
        z: finalPosition.z,
        duration: 1.4,
        ease: 'power2.out',
      },
      4.3
    );

    // ---------------------------------------------------------
    // 6. FINAL LOOK AT SCREEN
    // ---------------------------------------------------------

    tl.to(
      this.currentLookAt,
      {
        x: config.lookAt.x,
        y: config.lookAt.y,
        z: config.lookAt.z,
        duration: 1.4,
        ease: 'power2.inOut',
      },
      4.3
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
        y: 13.0,
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

      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      const isPortrait = height > width;

      const lobbyCamera = isPortrait
        ? {
          position: { x: 0, y: 2.6, z: 36 },
          lookAt: { x: 0, y: 2.7, z: 30 },
        }
        : {
          position: { x: 0, y: 2.2, z: 38 },
          lookAt: { x: 0, y: 2.2, z: 30 },
        };

      gsap.to(this.camera.position, {
        x: lobbyCamera.position.x,
        y: lobbyCamera.position.y,
        z: lobbyCamera.position.z,
        duration: 1.6,
        ease: 'power2.inOut',
      });

      gsap.to(this.currentLookAt, {
        x: lobbyCamera.lookAt.x,
        y: lobbyCamera.lookAt.y,
        z: lobbyCamera.lookAt.z,
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

    if (width <= 0 || height <= 0) return;

    // The Three.js camera must use the actual
    // available screen/container proportions.
    this.updateCameraForAspect(width, height);

    // Resize the WebGL drawing surface to exactly
    // match the available container.

    // Adjust ONLY the portrait mobile lobby camera.
    // Desktop and landscape keep the original camera position.
    if (this.currentState === 'LOBBY') {
      const isPortrait = height > width;

      if (isPortrait) {
        this.camera.position.set(0, 2.6, 36);
        this.currentLookAt.set(0, 2.7, 30);
      } else {
        this.camera.position.set(0, 2.2, 38);
        this.currentLookAt.set(0, 2.2, 30);
      }
    }
    this.renderer.setSize(width, height);
    this.cssRenderer.setSize(width, height);

    // Keep the scene sharp on phones/tablets with
    // high-density displays without excessive GPU usage.
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );
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

    // -------------------------------------------------------------
    // YOUTUBE SCREEN OCCLUSION
    // -------------------------------------------------------------
    if (this.youtubeScreen) {
      if (this.currentState === 'LOBBY') {
        this.youtubeScreen.visible = false;
      } else {
        this.youtubeScreen.visible =
          this.isScreenVisibleFromCamera();
      }
    }
    if (this.presenterScreen) {
      if (this.currentState === 'LOBBY') {
        this.presenterScreen.visible = false;
      } else {
        this.presenterScreen.visible =
          this.isPresenterScreenVisibleFromCamera();
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.cssRenderer.render(this.scene, this.camera);
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('click', this.onClick);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(
        this.renderer.domElement
      );
    }

    if (this.cssRenderer?.domElement.parentElement) {
      this.cssRenderer.domElement.parentElement.removeChild(
        this.cssRenderer.domElement
      );
    }

    this.renderer.dispose();
  }
}
