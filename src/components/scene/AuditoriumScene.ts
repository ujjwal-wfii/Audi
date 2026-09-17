import * as THREE from "three";
import gsap from "gsap";
import { SeatData, PovPosition } from "@/types/auditorium";
import { STAGE_CENTER, ROW_CONFIGS } from "@/utils/seatLayout";
import {
	createKeynoteScreenTexture,
	createEntranceSignTexture,
	createDoorSignTexture,
	createWoodStageTexture,
	createCarpetTexture,
	createMarbleTexture,
} from "@/utils/textureGenerator";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import {
	CSS3DRenderer,
	CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

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
		id: "LEFT",
		name: "Left VIP Seat POV",
		badge: "Left VIP • 90% Screen Immersion",
		description:
			"Direct straight-on frontal presentation view with 90% screen viewport occupancy",
		position: new THREE.Vector3(-3.2, 7.0, 15.5),
		lookAt: new THREE.Vector3(0.4, 7.0, -8.5),
		associatedSeatId: "C-3",
	},
	CENTER: {
		id: "CENTER",
		name: "Center VIP Sweet-Spot POV",
		badge: "Center Sweet-Spot • 90% Screen Immersion",
		description:
			"Prime central direct presentation view with 90% screen viewport occupancy",
		position: new THREE.Vector3(0, 7.0, 15.2),
		lookAt: new THREE.Vector3(0, 7.0, -8.5),
		associatedSeatId: "C-10",
	},
	RIGHT: {
		id: "RIGHT",
		name: "Right VIP Seat POV",
		badge: "Right VIP • 90% Screen Immersion",
		description:
			"Direct straight-on frontal presentation view with 90% screen viewport occupancy",
		position: new THREE.Vector3(3.2, 7.0, 15.5),
		lookAt: new THREE.Vector3(-0.4, 7.0, -8.5),
		associatedSeatId: "C-18",
	},
};

export interface SceneCallbacks {
	onGateHover: (hovering: boolean) => void;
	onStateChange: (
		state: "LOBBY" | "ENTERING" | "SEATED" | "CHANGING_SEAT" | "OVERVIEW",
	) => void;
	onPovChange: (pov: PovPosition) => void;
}

export class AuditoriumScene {
	private container: HTMLElement;
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private renderer: THREE.WebGLRenderer;
	private cssRenderer: CSS3DRenderer;
	private youtubeScreen: CSS3DObject | null = null;
	// Independent presenter screens. Each can load different content.
	private presenterScreens: Map<"LEFT" | "RIGHT", CSS3DObject> = new Map();
	private callbacks: SceneCallbacks;

	// State
	private currentPov: PovPosition = "CENTER";
	private currentState:
		| "LOBBY"
		| "ENTERING"
		| "SEATED"
		| "CHANGING_SEAT"
		| "OVERVIEW" = "LOBBY";
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
	private screenRaycaster = new THREE.Raycaster();
	private screenOccluders: THREE.Object3D[] = [];
	private readonly cameraWorldPosition = new THREE.Vector3();

	private lastPerformanceReport = 0;

	// ---------------------------------------------------------
	// SCREEN VISIBILITY PERFORMANCE CACHE
	// ---------------------------------------------------------
	// The auditorium still renders every frame, but expensive
	// screen-occlusion raycasts are checked only periodically.
	// This does NOT change the actual visibility algorithm.
	// ---------------------------------------------------------

	private lastScreenVisibilityCheck = 0;
	private readonly screenVisibilityInterval = 300; // milliseconds

	// Lights
	private ambientLight!: THREE.AmbientLight;
	private stageSpot1!: THREE.SpotLight;
	private stageSpot2!: THREE.SpotLight;
	private centerSpot!: THREE.SpotLight;
	private houseLight!: THREE.DirectionalLight;
	private screenMesh!: THREE.Mesh;

	// Animation frame
	private animationFrameId: number | null = null;

	private isRenderLoopRunning = false;

	private needsRender = true;

	/**
	 * True only while something genuinely needs continuous frames,
	 * such as a camera transition.
	 */
	private isContinuousAnimationActive = false;
	private isDestroyed = false;
	// Observes the actual canvas/container size.
	// More reliable than relying only on window resize events.
	private resizeObserver: ResizeObserver | null = null;
	private readonly referenceAspect = 16 / 9;
	private readonly referenceFov = 60;

	private lookTarget = new THREE.Vector3();
	private areScreensRevealed = false;

	constructor(
		container: HTMLElement,
		seats: SeatData[],
		callbacks: SceneCallbacks,
	) {
		this.container = container;
		this.callbacks = callbacks;

		// Initialize Three.js core
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x060810);
		this.scene.fog = new THREE.FogExp2(0x060810, 0.007);

		const width = container.clientWidth || window.innerWidth;
		const height = container.clientHeight || window.innerHeight;

		// Camera with 54° FOV: Keynote Screen occupies 90% of viewport when seated
		this.camera = new THREE.PerspectiveCamera(
			this.referenceFov,
			width / height,
			0.05,
			200,
		);
		// Initial camera in Lobby
		this.camera.position.set(0, 2.2, 38);
		this.currentLookAt.set(0, 2.2, 30);
		this.camera.lookAt(this.currentLookAt);

		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: false,
			powerPreference: "high-performance",
		});
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		// -------------------------------------------------------------
		// CSS3D RENDERER FOR YOUTUBE VIDEO ON THE 3D SCREEN
		// -------------------------------------------------------------
		this.cssRenderer = new CSS3DRenderer();

		this.cssRenderer.setSize(width, height);

		this.cssRenderer.domElement.style.position = "absolute";
		this.cssRenderer.domElement.style.top = "0";
		this.cssRenderer.domElement.style.left = "0";
		this.cssRenderer.domElement.style.width = "100%";
		this.cssRenderer.domElement.style.height = "100%";
		this.cssRenderer.domElement.style.pointerEvents = "none";
		this.cssRenderer.domElement.style.zIndex = "1";

		this.container.appendChild(this.cssRenderer.domElement);

		// Keep WebGL behind/alongside the CSS3D layer.
		this.renderer.domElement.style.position = "absolute";
		this.renderer.domElement.style.top = "0";
		this.renderer.domElement.style.left = "0";
		this.renderer.domElement.style.zIndex = "0";
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.15;
		this.renderer.shadowMap.enabled = false; // true for shadows, false for performance this is for test only
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

		window.addEventListener("resize", this.onWindowResize);
		window.addEventListener("pointermove", this.onPointerMove);
		window.addEventListener("click", this.onClick);
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

		this.requestRender();
	}
	// helper to bake transforms
	private createMergedGeometry(
		parts: {
			geometry: THREE.BufferGeometry;
			position?: THREE.Vector3;
			rotation?: THREE.Euler;
			scale?: THREE.Vector3;
		}[],
	): THREE.BufferGeometry {
		const geometries = parts.map((part) => {
			const geometry = part.geometry.clone();

			const position = part.position ?? new THREE.Vector3();
			const rotation = part.rotation ?? new THREE.Euler();
			const scale = part.scale ?? new THREE.Vector3(1, 1, 1);

			const quaternion = new THREE.Quaternion().setFromEuler(rotation);

			const matrix = new THREE.Matrix4().compose(
				position,
				quaternion,
				scale,
			);

			geometry.applyMatrix4(matrix);

			return geometry;
		});

		const merged = mergeGeometries(geometries, false);

		if (!merged) {
			throw new Error("Failed to merge seat geometries");
		}

		// Temporary cloned geometries are no longer needed.
		for (const geometry of geometries) {
			geometry.dispose();
		}

		return merged;
	}
	/* -------------------------------------------------------------
     LIGHTING SETUP
  ------------------------------------------------------------- */
	private setupLighting() {
		this.ambientLight = new THREE.AmbientLight(0xfff4e6, 1.15);
		this.scene.add(this.ambientLight);

		this.houseLight = new THREE.DirectionalLight(0xffe8cc, 1.1);
		this.houseLight.position.set(0, 24, 12);
		this.houseLight.castShadow = false;
		this.houseLight.shadow.mapSize.width = 2048;
		this.houseLight.shadow.mapSize.height = 2048;
		this.scene.add(this.houseLight);

		// Stage Spotlights
		this.stageSpot1 = new THREE.SpotLight(
			0x38bdf8,
			5.5,
			55,
			Math.PI / 4,
			0.35,
			1,
		);
		this.stageSpot1.position.set(-15, 16, 4);
		this.stageSpot1.target.position.set(STAGE_CENTER.x - 2, 5.0, -8.5);
		this.scene.add(this.stageSpot1);
		this.scene.add(this.stageSpot1.target);

		this.stageSpot2 = new THREE.SpotLight(
			0x818cf8,
			5.0,
			55,
			Math.PI / 4,
			0.35,
			1,
		);
		this.stageSpot2.position.set(15, 16, 4);
		this.stageSpot2.target.position.set(STAGE_CENTER.x + 2, 5.0, -8.5);
		this.scene.add(this.stageSpot2);
		this.scene.add(this.stageSpot2.target);

		// Center Stage Warm Keynote Light
		this.centerSpot = new THREE.SpotLight(
			0xfffae0,
			6.5,
			45,
			Math.PI / 5,
			0.25,
		);
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

		const youtubeVideoId = "WjSNkTVHB88";

		const wrapper = document.createElement("div");

		// Large CSS canvas which gets scaled into Three.js world units.
		const cssWidth = 1000;
		const cssHeight = cssWidth * (screenHeight / screenWidth);

		wrapper.style.width = `${cssWidth}px`;
		wrapper.style.height = `${cssHeight}px`;
		wrapper.style.background = "#000";
		wrapper.style.overflow = "hidden";
		wrapper.style.border = "20px solid #5c3822";
		wrapper.style.boxSizing = "border-box";
		wrapper.style.borderRadius = "18px";
		wrapper.style.pointerEvents = "none";

		const iframe = document.createElement("iframe");

		iframe.src =
			`https://www.youtube.com/embed/${youtubeVideoId}` +
			`?autoplay=1` +
			`&controls=0` +
			`&rel=0` +
			`&modestbranding=1` +
			`&playsinline=1` +
			`&enablejsapi=1`;
		iframe.style.width = "100%";
		iframe.style.height = "100%";
		iframe.style.border = "0";
		iframe.style.display = "block";
		iframe.style.pointerEvents = "none";

		iframe.setAttribute("allow", "autoplay; encrypted-media");
		iframe.setAttribute("allowfullscreen", "");

		wrapper.appendChild(iframe);

		const videoObject = new CSS3DObject(wrapper);

		// Match the exact position of your existing physical screen.
		videoObject.position.set(0, screenHeight / 2, -8.49);

		videoObject.rotation.set(0, 0, 0);

		// Convert the 1000px CSS element into the same
		// 28 x 13 Three.js dimensions as the real screen.
		const worldScale = screenWidth / cssWidth;

		videoObject.scale.set(worldScale, worldScale, worldScale);

		this.youtubeScreen = videoObject;

		this.scene.add(videoObject);
	}
	// -------------------------------------------------------------
	// STOP YOUTUBE LIVE VIDEO
	// -------------------------------------------------------------
	private stopYouTubeVideo() {
		if (!this.youtubeScreen) return;

		const wrapper = this.youtubeScreen.element;
		const iframe = wrapper.querySelector("iframe");

		if (iframe) {
			iframe.src = "about:blank";
			iframe.remove();
		}

		this.youtubeScreen.visible = false;
	}
	// -------------------------------------------------------------
	// PRESENTER SCREENS
	// LEFT and RIGHT are independent so different content can be
	// loaded on each screen later without changing the architecture.
	// -------------------------------------------------------------

	private readonly presenterScreenConfig: Record<
		"LEFT" | "RIGHT",
		{
			videoId: string;
			x: number;
			y?: number;
			z: number;
		}
	> = {
		LEFT: {
			videoId: "yZrV-5vvZSE",
			x: -11.0,
			z: -0.5,
		},
		RIGHT: {
			// Keep this the same for now. Change independently later.
			videoId: "yZrV-5vvZSE",
			x: 11.0,
			z: -0.5,
		},
	};

	private stopPresenterVideo() {
		this.presenterScreens.forEach((screen) => {
			const iframe = screen.element.querySelector("iframe");

			if (iframe) {
				iframe.src = "about:blank";
				iframe.remove();
			}

			screen.visible = false;
		});

		this.presenterScreens.clear();
	}

	private createPresenterScreen(
		side: "LEFT" | "RIGHT",
		videoId = this.presenterScreenConfig[side].videoId,
	) {
		const screenWidth = 4;
		const screenHeight = 7.1111;
		const stageHeight = 1.2;
		const config = this.presenterScreenConfig[side];

		const wrapper = document.createElement("div");

		const cssWidth = 500;
		const cssHeight = 888.89;

		wrapper.style.width = `${cssWidth}px`;
		wrapper.style.height = `${cssHeight}px`;
		wrapper.style.background = "#000";
		wrapper.style.overflow = "hidden";
		wrapper.style.border = "20px solid #5c3822";
		wrapper.style.boxSizing = "border-box";
		wrapper.style.borderRadius = "18px";
		wrapper.style.pointerEvents = "none";

		const iframe = document.createElement("iframe");

		iframe.src =
			`https://www.youtube.com/embed/${videoId}` +
			`?autoplay=1` +
			`&controls=0` +
			`&rel=0` +
			`&muted=1` +
			`&modestbranding=1` +
			`&playsinline=1` +
			`&enablejsapi=1`;

		iframe.style.width = "100%";
		iframe.style.height = "100%";
		iframe.style.border = "0";
		iframe.style.display = "block";
		iframe.style.pointerEvents = "none";

		iframe.setAttribute("allow", "autoplay; encrypted-media");
		iframe.setAttribute("allowfullscreen", "");

		wrapper.appendChild(iframe);

		const presenterScreen = new CSS3DObject(wrapper);

		presenterScreen.position.set(
			config.x,
			stageHeight + screenHeight / 2,
			config.z,
		);

		presenterScreen.rotation.set(0, 0, 0);

		const worldScale = screenWidth / cssWidth;
		presenterScreen.scale.set(worldScale, worldScale, worldScale);
		presenterScreen.visible = false;

		this.presenterScreens.set(side, presenterScreen);
		this.scene.add(presenterScreen);

		return presenterScreen;
	}

	private createAllPresenterScreens() {
		this.stopPresenterVideo();
		this.createPresenterScreen("LEFT");
		this.createPresenterScreen("RIGHT");
	}

	private addScreenOccluder(object: THREE.Object3D) {
		this.screenOccluders.push(object);
	}
	// -------------------------------------------------------------
	// CHECK WHETHER THE 3D AUDITORIUM SCREEN IS VISIBLE
	// -------------------------------------------------------------
	private isScreenVisibleFromCamera(): boolean {
		if (!this.screenMesh) return false;

		const cameraPosition = this.camera.getWorldPosition(
			this.cameraWorldPosition,
		);

		const screenWidth = 28;
		const screenHeight = 13;

		const screenPoints = [
			new THREE.Vector3(0, 0, 0),

			new THREE.Vector3(-screenWidth * 0.42, screenHeight * 0.42, 0),

			new THREE.Vector3(screenWidth * 0.42, screenHeight * 0.42, 0),

			new THREE.Vector3(-screenWidth * 0.42, -screenHeight * 0.42, 0),

			new THREE.Vector3(screenWidth * 0.42, -screenHeight * 0.42, 0),
		];

		let visiblePoints = 0;

		for (const localPoint of screenPoints) {
			const worldPoint = localPoint.clone();

			this.screenMesh.localToWorld(worldPoint);

			const direction = worldPoint
				.clone()
				.sub(cameraPosition)
				.normalize();

			const distanceToScreen = cameraPosition.distanceTo(worldPoint);

			// IMPORTANT:
			// Use screenRaycaster, not the interactive raycaster.
			this.screenRaycaster.set(cameraPosition, direction);

			this.screenRaycaster.far = distanceToScreen - 0.1;

			const intersections = this.screenRaycaster.intersectObjects(
				this.screenOccluders,
				false,
			);

			if (intersections.length === 0) {
				visiblePoints++;
			}

			// Early exit:
			// We already have enough visible points.
			if (visiblePoints >= 2) {
				return true;
			}
		}

		return false;
	}
	// -------------------------------------------------------------
	// -------------------------------------------------------------
	// CHECK WHETHER A VERTICAL PRESENTER SCREEN IS VISIBLE
	// Each screen is checked independently.
	// -------------------------------------------------------------
	private isPresenterScreenVisibleFromCamera(screen: CSS3DObject): boolean {
		const cameraPosition = this.camera.getWorldPosition(
			this.cameraWorldPosition,
		);

		const screenWidth = 4;
		const screenHeight = 7.1111;

		const screenPoints = [
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(-screenWidth * 0.42, screenHeight * 0.42, 0),
			new THREE.Vector3(screenWidth * 0.42, screenHeight * 0.42, 0),
			new THREE.Vector3(-screenWidth * 0.42, -screenHeight * 0.42, 0),
			new THREE.Vector3(screenWidth * 0.42, -screenHeight * 0.42, 0),
		];

		let visiblePoints = 0;

		for (const localPoint of screenPoints) {
			const worldPoint = localPoint.clone();
			screen.localToWorld(worldPoint);

			const direction = worldPoint
				.clone()
				.sub(cameraPosition)
				.normalize();

			const distanceToScreen = cameraPosition.distanceTo(worldPoint);

			this.screenRaycaster.set(cameraPosition, direction);
			this.screenRaycaster.far = distanceToScreen - 0.1;

			const intersections = this.screenRaycaster.intersectObjects(
				this.screenOccluders,
				false,
			);

			if (intersections.length === 0) {
				visiblePoints++;
			}

			if (visiblePoints >= 2) return true;
		}

		return false;
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
			stageDepth,
		);
		const stage = new THREE.Mesh(stageGeo, stageMaterial);
		// stage.rotation.y = -Math.PI / 2;
		stage.position.set(STAGE_CENTER.x, stageHeight / 2, -7.5);
		stage.receiveShadow = true;
		this.scene.add(stage);
		this.addScreenOccluder(stage);

		const screenWidth = 28;
		const screenHeight = 13;

		const screenGeo = new THREE.PlaneGeometry(screenWidth, screenHeight);

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

		const backWallZ = -11;
		const backWallMat = new THREE.MeshStandardMaterial({
			color: 0xd6c7b0,
			roughness: 0.85,
			metalness: 0.1,
		});
		const backWall = new THREE.Mesh(
			new THREE.BoxGeometry(50, 24, 1.0),
			backWallMat,
		);
		backWall.position.set(0, 12, backWallZ);
		backWall.receiveShadow = true;
		this.scene.add(backWall);

		// Side "return" walls that close the gap between the proscenium and the
		// rear wall, so there's no visible gap/void at a grazing viewing angle.
		const wingReturnMat = new THREE.MeshStandardMaterial({
			color: 0xd6c7b0,
			roughness: 0.8,
		});
		const wingDepth = 7; // fixed depth — plenty to close the gap regardless of screen geometry
		for (const side of [-1, 1]) {
			const wing = new THREE.Mesh(
				new THREE.BoxGeometry(1.0, 24, wingDepth),
				wingReturnMat,
			);
			wing.position.set(side * 24, 12, backWallZ + wingDepth / 2 + 0.5);
			this.scene.add(wing);
		}

		// =========================
		// Plants beside the screen
		// =========================
		const dracoLoader = new DRACOLoader();
		// Uses absolute path relative to the public/ folder
		dracoLoader.setDecoderPath("/draco/");

		const plantLoader = new GLTFLoader();
		plantLoader.setDRACOLoader(dracoLoader);
		plantLoader.setMeshoptDecoder(MeshoptDecoder);

		plantLoader.load(
			"/models/plant-final.glb", // Recommended: Use plant-final.glb if WebP-compressed
			(gltf) => {
				const plantSource = gltf.scene;

				// Extract geometry and material from the first mesh found in the GLTF
				let plantGeometry: THREE.BufferGeometry | null = null;
				let plantMaterial: THREE.Material | THREE.Material[] | null =
					null;

				plantSource.traverse((child) => {
					if (child instanceof THREE.Mesh && !plantGeometry) {
						plantGeometry = child.geometry;
						plantMaterial = child.material;
					}
				});

				if (!plantGeometry || !plantMaterial) {
					console.error("No valid mesh found in plant GLB");
					return;
				}

				// Define positions for the 4 plants
				const positions = [
					[-17, 3.5, -7],
					[17, 3.5, -7],
					[-22, 3.5, -1],
					[22, 3.5, -1],
				];

				const count = positions.length;

				// 2. Create a single InstancedMesh for all 4 plants
				const instancedPlant = new THREE.InstancedMesh(
					plantGeometry,
					plantMaterial,
					count,
				);

				const dummy = new THREE.Object3D();
				const scale = 3;

				// 3. Set transformation matrix for each plant instance
				positions.forEach(([x, y, z], index) => {
					dummy.position.set(x, y, z);
					dummy.scale.setScalar(scale);
					dummy.rotation.y = 0;
					dummy.updateMatrix();

					instancedPlant.setMatrixAt(index, dummy.matrix);
				});

				// Update matrices on the GPU
				instancedPlant.instanceMatrix.needsUpdate = true;
				instancedPlant.castShadow = false;
				instancedPlant.receiveShadow = false;

				this.scene.add(instancedPlant);
				this.addScreenOccluder(instancedPlant);
			},
			undefined,
			(error) => {
				console.error("PLANT GLB FAILED TO LOAD:", error);
			},
		);
		//Adding Sofa in front of stage
		const sofaLoader = new GLTFLoader();

		sofaLoader.load(
			"/models/sofa.glb",
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
							child.castShadow = false;
							child.receiveShadow = false;
							if (child.material) {
								child.material.transparent = false;
								child.material.opacity = 1;
							}
						}
					});

					this.scene.add(sofa);
					this.addScreenOccluder(sofa);
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
				console.error("SOFA GLB FAILED TO LOAD:", error);
			},
		);

		// 4. Acoustic Wooden Slat Side Walls
		const wallBeigeMat = new THREE.MeshStandardMaterial({
			color: 0xd6c7b0,
			roughness: 0.75,
			metalness: 0.0,
		});
		// Decorative wooden wall fins — dark warm wood
		const wallFinWoodMat = new THREE.MeshStandardMaterial({
			color: 0x5a3824,
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
			this.addScreenOccluder(wall);

			for (let i = 0; i < 9; i++) {
				const finGeo = new THREE.BoxGeometry(0.35, 12, 1.4);
				const fin = new THREE.Mesh(finGeo, wallFinWoodMat);
				fin.position.set(side * 23.4, 7.2, -5 + i * 4.2);
				fin.rotation.y = side * -0.28;
				this.scene.add(fin);
				this.addScreenOccluder(fin);

				if (i % 2 === 1) {
					const sconceGeo = new THREE.BoxGeometry(0.2, 0.8, 0.3);
					const sconce = new THREE.Mesh(sconceGeo, sconceGlowMat);
					sconce.position.set(side * 23.2, 7.0, -5 + i * 4.2);
					this.scene.add(sconce);
					sconce.castShadow = false;
					sconce.receiveShadow = false;
				}
			}
		}

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
				rowDepth,
			);

			const platformMesh = new THREE.Mesh(platformGeo, tierCarpetMat);

			platformMesh.position.set(STAGE_CENTER.x, elevation - 0.075, z);

			platformMesh.castShadow = false;
			platformMesh.receiveShadow = false;

			this.scene.add(platformMesh);
			this.tierMeshes.push(platformMesh);

			// --------------------------------
			// FRONT OF STEP / RISER
			// --------------------------------

			if (fasciaHeight > 0) {
				const fasciaGeo = new THREE.BoxGeometry(
					seatingWidth,
					fasciaHeight,
					0.12,
				);

				const fasciaMesh = new THREE.Mesh(fasciaGeo, tierFrontMat);

				fasciaMesh.position.set(
					STAGE_CENTER.x,
					elevation - fasciaHeight / 2,
					z - rowDepth / 2,
				);

				fasciaMesh.castShadow = false;
				fasciaMesh.receiveShadow = false;

				this.scene.add(fasciaMesh);
				this.tierMeshes.push(fasciaMesh);
			}

			// --------------------------------
			// CENTER AISLE STEP LIGHT
			// --------------------------------

			const aisleStepGeo = new THREE.BoxGeometry(1.6, 0.04, 0.12);

			const aisleStepLight = new THREE.Mesh(aisleStepGeo, stepAmberMat);

			aisleStepLight.position.set(0, elevation + 0.02, z - rowDepth / 2);

			this.scene.add(aisleStepLight);
			this.tierMeshes.push(aisleStepLight);
		});
		this.tierMeshes.forEach((mesh) => {
			this.addScreenOccluder(mesh);
		});
		// 6. Solid Flat Ground Floor
		const groundFloorGeo = new THREE.PlaneGeometry(50, 30);
		const groundFloorMesh = new THREE.Mesh(groundFloorGeo, tierCarpetMat);
		groundFloorMesh.rotation.x = -Math.PI / 2;
		groundFloorMesh.position.set(0, 0, 4);
		this.scene.add(groundFloorMesh);

		// 7. white Ceiling with Overhead Spotlights & Architectural Beams
		const ceilingMat = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			roughness: 0.9,
		});
		const ceilingMesh = new THREE.Mesh(
			new THREE.PlaneGeometry(48, 52),
			ceilingMat,
		);
		ceilingMesh.rotation.x = Math.PI / 2;
		ceilingMesh.position.set(0, 16.5, 12);
		this.scene.add(ceilingMesh);

		for (let tz = 0; tz < 28; tz += 9) {
			const trussGeo = new THREE.BoxGeometry(42, 0.45, 0.45);
			const trussMat = new THREE.MeshStandardMaterial({
				color: 0x162033,
				metalness: 0.8,
				roughness: 0.3,
			});
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
		const foyerFloor = new THREE.Mesh(
			new THREE.PlaneGeometry(26, 20),
			foyerFloorMat,
		);
		foyerFloor.rotation.x = -Math.PI / 2;
		foyerFloor.position.set(0, 0, lobbyZ + 6);
		this.scene.add(foyerFloor);

		const wallMat = new THREE.MeshStandardMaterial({
			color: 0xe9e3d4,
			roughness: 0.6,
		});

		const leftWall = new THREE.Mesh(
			new THREE.BoxGeometry(9, 10, 0.6),
			wallMat,
		);
		leftWall.position.set(-7.5, 5, lobbyZ);
		this.scene.add(leftWall);

		const rightWall = new THREE.Mesh(
			new THREE.BoxGeometry(9, 10, 0.6),
			wallMat,
		);
		rightWall.position.set(7.5, 5, lobbyZ);
		this.scene.add(rightWall);

		const topWall = new THREE.Mesh(
			new THREE.BoxGeometry(7, 5.5, 0.6),
			wallMat,
		);
		topWall.position.set(0, 7.25, lobbyZ);
		this.scene.add(topWall);

		const signTexture = createEntranceSignTexture();
		const signMat = new THREE.MeshBasicMaterial({ map: signTexture });
		const signMesh = new THREE.Mesh(
			new THREE.PlaneGeometry(3.8, 0.65),
			signMat,
		);
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

		const leftDoorPanel = new THREE.Mesh(
			new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness),
			doorGlassMat,
		);
		leftDoorPanel.position.set(doorWidth / 2, doorHeight / 2, 0);
		this.leftDoorGroup.add(leftDoorPanel);

		const handleMat = new THREE.MeshStandardMaterial({
			color: 0xf59e0b,
			metalness: 0.8,
			roughness: 0.2,
		});
		const leftHandle = new THREE.Mesh(
			new THREE.CylinderGeometry(0.04, 0.04, 1.2),
			handleMat,
		);
		leftHandle.position.set(doorWidth - 0.2, 2.0, 0.12);
		this.leftDoorGroup.add(leftHandle);

		const leftSignTex = createDoorSignTexture("PUSH");
		const leftSign = new THREE.Mesh(
			new THREE.PlaneGeometry(0.8, 0.8),
			new THREE.MeshBasicMaterial({ map: leftSignTex }),
		);
		leftSign.position.set(doorWidth / 2, 2.8, 0.09);
		this.leftDoorGroup.add(leftSign);

		this.scene.add(this.leftDoorGroup);

		this.rightDoorGroup = new THREE.Group();
		this.rightDoorGroup.position.set(doorWidth, 0, lobbyZ);

		const rightDoorPanel = new THREE.Mesh(
			new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness),
			doorGlassMat,
		);
		rightDoorPanel.position.set(-doorWidth / 2, doorHeight / 2, 0);
		this.rightDoorGroup.add(rightDoorPanel);

		const rightHandle = new THREE.Mesh(
			new THREE.CylinderGeometry(0.04, 0.04, 1.2),
			handleMat,
		);
		rightHandle.position.set(-doorWidth + 0.2, 2.0, 0.12);
		this.rightDoorGroup.add(rightHandle);

		const rightSignTex = createDoorSignTexture("PUSH");
		const rightSign = new THREE.Mesh(
			new THREE.PlaneGeometry(0.8, 0.8),
			new THREE.MeshBasicMaterial({ map: rightSignTex }),
		);
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
	}
	// helper function to freeze the matrices of an object and its children
	private freezeObjectMatrices(object: THREE.Object3D) {
		object.updateMatrix();

		object.traverse((child) => {
			child.updateMatrix();
			child.matrixAutoUpdate = false;
		});

		object.matrixAutoUpdate = false;
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
		const createRoundedGeometry = (
			width: number,
			height: number,
			depth: number,
			radius: number,
		) => {
			const shape = new THREE.Shape();

			const x = -width / 2;
			const y = -height / 2;

			shape.moveTo(x + radius, y);
			shape.lineTo(x + width - radius, y);

			shape.quadraticCurveTo(x + width, y, x + width, y + radius);

			shape.lineTo(x + width, y + height - radius);

			shape.quadraticCurveTo(
				x + width,
				y + height,
				x + width - radius,
				y + height,
			);

			shape.lineTo(x + radius, y + height);

			shape.quadraticCurveTo(x, y + height, x, y + height - radius);

			shape.lineTo(x, y + radius);

			shape.quadraticCurveTo(x, y, x + radius, y);

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

			return geometry;
		};
		// ---------------------------------------------------------
		// SHARED SEAT GEOMETRIES
		// ---------------------------------------------------------
		// IMPORTANT:
		// These are created ONCE and reused by all seats.
		// The geometry dimensions and bevel settings are unchanged.
		// ---------------------------------------------------------

		const cushionGeometry = createRoundedGeometry(
			seatWidth,
			0.2,
			0.7,
			0.055,
		);
		cushionGeometry.name = "seat-cushion";

		const frontBolsterGeometry = createRoundedGeometry(
			seatWidth,
			0.075,
			0.1,
			0.035,
		);
		frontBolsterGeometry.name = "seat-front-bolster";
		const backrestGeometry = createRoundedGeometry(
			seatWidth + 0.1,
			1.15,
			0.2,
			0.075,
		);
		backrestGeometry.name = "seat-backrest";

		const armPanelGeometry = createRoundedGeometry(0.11, 0.62, 0.58, 0.025);
		armPanelGeometry.name = "seat-arm-panel";

		const armTopCapGeometry = createRoundedGeometry(
			0.075,
			0.045,
			0.5,
			0.015,
		);
		armTopCapGeometry.name = "seat-arm-top-cap";

		const endPanelGeometry = createRoundedGeometry(0.11, 0.65, 0.52, 0.025);
		endPanelGeometry.name = "seat-end-panel";

		const brassTrimGeometry = new THREE.BoxGeometry(0.012, 0.028, 0.48);

		const supportGeometry = new THREE.CylinderGeometry(
			0.035,
			0.045,
			0.36,
			8,
		);

		const ledGeometry = new THREE.BoxGeometry(0.012, 0.035, 0.055);
		// -------------------------------------------------------
		// MERGED SEAT GEOMETRIES
		// -------------------------------------------------------
		// Each material category becomes one mesh per seat.
		// This reduces the seat from ~9-12 meshes to ~4-5.
		// -------------------------------------------------------

		const armX = seatWidth / 2 + 0.055;

		// Velvet
		const mergedVelvetGeometry = this.createMergedGeometry([
			{
				geometry: cushionGeometry,
				position: new THREE.Vector3(0, 0.43, 0),
			},
			{
				geometry: frontBolsterGeometry,
				position: new THREE.Vector3(0, 0.375, -0.235),
			},
			{
				geometry: backrestGeometry,
				position: new THREE.Vector3(0, 0.995, 0.225),
				rotation: new THREE.Euler(-0.1, 0, 0),
			},
		]);
		mergedVelvetGeometry.name = "merged-velvet-geometry";

		// Walnut
		const mergedWalnutGeometry = this.createMergedGeometry([
			// LEFT arm panel
			{
				geometry: armPanelGeometry,
				position: new THREE.Vector3(-armX, 0.5, 0),
			},

			// LEFT arm top cap
			{
				geometry: armTopCapGeometry,
				position: new THREE.Vector3(-armX, 0.825, 0.02),
			},

			// RIGHT arm panel
			{
				geometry: armPanelGeometry,
				position: new THREE.Vector3(armX, 0.5, 0),
			},

			// RIGHT arm top cap
			{
				geometry: armTopCapGeometry,
				position: new THREE.Vector3(armX, 0.825, 0.02),
			},
		]);
		mergedWalnutGeometry.name = "merged-walnut-geometry";
		// Brass
		const mergedBrassGeometry = this.createMergedGeometry([
			{
				geometry: brassTrimGeometry,
				position: new THREE.Vector3(-armX + 0.035, 0.825, 0.02),
			},
			{
				geometry: brassTrimGeometry,
				position: new THREE.Vector3(armX + 0.035, 0.825, 0.02),
			},
		]);
		mergedBrassGeometry.name = "merged-brass-geometry";
		// Metal
		const mergedMetalGeometry = this.createMergedGeometry([
			{
				geometry: supportGeometry,
				position: new THREE.Vector3(0, 0.2, 0),
			},
		]);
		mergedMetalGeometry.name = "merged-metal-geometry";
		const leftEndPanelGeometry = this.createMergedGeometry([
			{
				geometry: endPanelGeometry,
				position: new THREE.Vector3(-0.36, 0.52, -0.04),
			},
		]);
		leftEndPanelGeometry.name = "left-end-panel-geometry";

		const rightEndPanelGeometry = this.createMergedGeometry([
			{
				geometry: endPanelGeometry,
				position: new THREE.Vector3(0.36, 0.52, -0.04),
			},
		]);
		rightEndPanelGeometry.name = "right-end-panel-geometry";
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
				(rowConfig) => rowConfig.row === seat.row,
			);

			const straightZ = firstRowZ + rowIndex * rowSpacing;

			let straightX: number;

			if (seat.number <= seatsPerSide) {
				// LEFT SIDE: seats 1-6
				straightX =
					-(centerAisleHalfWidth + seatPitch / 2) -
					(seatsPerSide - 1 - (seat.number - 1)) * seatPitch;
			} else if (seat.number <= seatsPerSide * 2) {
				// RIGHT SIDE: seats 7-12
				straightX =
					centerAisleHalfWidth +
					seatPitch / 2 +
					(seat.number - seatsPerSide - 1) * seatPitch;
			} else {
				// Ignore seats 13 and above
				return;
			}

			seatGroup.position.set(straightX, seat.position.y, straightZ);

			// Every seat faces the screen in exactly the same direction.
			seatGroup.rotation.set(0, 0, 0);

			// IMPORTANT:
			// These are required by your existing POV system.
			this.seatPositions.set(
				seat.id,
				new THREE.Vector3(straightX, seat.position.y, straightZ),
			);

			// -------------------------------------------------------
			// Preserve your existing seat status/tier logic
			// -------------------------------------------------------

			// -------------------------------------------------------
			// MERGED SEAT MESHES
			// -------------------------------------------------------

			// 1. ALL VELVET PARTS
			const velvetSeat = new THREE.Mesh(mergedVelvetGeometry, velvetMat);

			velvetSeat.castShadow = false;
			velvetSeat.receiveShadow = false;

			seatGroup.add(velvetSeat);

			// -------------------------------------------------------
			// 2. ALL WALNUT PARTS
			// -------------------------------------------------------

			const walnutSeat = new THREE.Mesh(mergedWalnutGeometry, walnutMat);

			walnutSeat.castShadow = false;
			walnutSeat.receiveShadow = false;

			seatGroup.add(walnutSeat);

			// -------------------------------------------------------
			// 3. ALL BRASS PARTS
			// -------------------------------------------------------

			const brassSeat = new THREE.Mesh(mergedBrassGeometry, brassMat);

			brassSeat.castShadow = false;
			brassSeat.receiveShadow = false;

			seatGroup.add(brassSeat);

			// -------------------------------------------------------
			// 4. CENTRAL SUPPORT
			// -------------------------------------------------------

			const metalSeat = new THREE.Mesh(mergedMetalGeometry, darkMetalMat);

			metalSeat.castShadow = false;
			metalSeat.receiveShadow = false;

			seatGroup.add(metalSeat);

			// -------------------------------------------------------
			// 5. AISLE-END PANEL + LED
			// -------------------------------------------------------

			if (seat.number === 1 || seat.number === 7) {
				const isLeftAisle = seat.number === 1;

				// Aisle wood panel
				const endPanel = new THREE.Mesh(
					isLeftAisle ? leftEndPanelGeometry : rightEndPanelGeometry,
					walnutMat,
				);

				endPanel.castShadow = false;
				endPanel.receiveShadow = false;

				seatGroup.add(endPanel);

				// Aisle LED
				const led = new THREE.Mesh(ledGeometry, ledMat);

				led.position.set(isLeftAisle ? -0.405 : 0.405, 0.66, 0.1);

				led.castShadow = false;
				led.receiveShadow = false;

				seatGroup.add(led);
			}

			// -------------------------------------------------------
			// Add seat to scene and preserve existing seat map
			// -------------------------------------------------------

			this.scene.add(seatGroup);

			this.seatMeshes.set(seat.id, seatGroup);
			this.freezeObjectMatrices(seatGroup);

			// this.addScreenOccluder(seatGroup);
		});

		// ---------------------------------------------------------
		// ACTIVE SELECTION BEACON
		// Keep this exactly as part of the existing POV system.
		// ---------------------------------------------------------

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

		this.activeBeaconRing.position.set(
			config.position.x,
			0.1,
			config.position.z,
		);

		// In SEATED POV mode:
		// 1. Hide the floor riser platforms that create horizontal brown strips across the screen
		// 2. Hide any foreground chairs in line of sight
		if (
			this.currentState === "SEATED"
			// this.currentState === "CHANGING_SEAT"
		) {
			// Hide all tiered platform strips in front of screen for 100% crystal-clear view
			this.tierMeshes.forEach((mesh) => {
				mesh.visible = false;
			});

			const povX = config.position.x;
			const povZ = config.position.z;

			this.seatMeshes.forEach((group, seatId) => {
				const pos = this.seatPositions.get(seatId);
				if (!pos) return;

				const dist = Math.sqrt(
					(pos.x - povX) ** 2 + (pos.z - povZ) ** 2,
				);
				const isInForeground =
					pos.z < povZ + 1.5 && Math.abs(pos.x - povX) < 5.0;

				if (dist < 3.5 || isInForeground) {
					group.visible = false;
				} else {
					group.visible = false;
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
		this.requestRender();
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
						this.referenceAspect,
				);

			const mobileFov =
				(2 *
					Math.atan(Math.tan(referenceHorizontalFov / 2) / aspect) *
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
		targetPov: PovPosition = "CENTER",
		onComplete?: () => void,
	) {
		this.startContinuousRendering();
		this.currentState = "ENTERING";
		this.callbacks.onStateChange("ENTERING");

		this.currentPov = targetPov;

		// Keep both screens hidden during the entrance cinematic.
		this.areScreensRevealed = false;

		this.createYouTubeScreen();
		this.createAllPresenterScreens();

		if (this.youtubeScreen) {
			this.youtubeScreen.visible = false;
		}

		this.presenterScreens.forEach((screen) => {
			screen.visible = false;
		});

		const config = POV_PRESETS[targetPov];

		const aisleStart = new THREE.Vector3(0, 7.0, 20.0);

		const aisleTop = new THREE.Vector3(0, 7.0, 17.5);

		// const aisleMiddle = new THREE.Vector3(
		//   0,
		//   7.0,
		//   16.2
		// );

		// Final destination is the actual selected seat POV
		const finalPosition = config.position;

		const tl = gsap.timeline({
			onComplete: () => {
				this.currentState = "SEATED";
				this.callbacks.onStateChange("SEATED");

				this.updateActivePovVisual(targetPov);
				this.callbacks.onPovChange(targetPov);

				// Finish the continuous render loop.
				this.stopContinuousRendering();

				// Render the final seated state once.
				this.requestRender();

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
				ease: "power2.inOut",
			},
			0,
		);

		tl.to(
			this.rightDoorGroup.rotation,
			{
				y: -Math.PI * 0.45,
				duration: 1.2,
				ease: "power2.inOut",
			},
			0,
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
				ease: "power2.inOut",
			},
			0.5,
		);

		// Look toward the screen
		tl.to(
			this.currentLookAt,
			{
				x: config.lookAt.x,
				y: config.lookAt.y,
				z: config.lookAt.z,
				duration: 1.4,
				ease: "power2.out",
			},
			0.5,
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
				ease: "power2.inOut",
			},
			1.9,
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
				ease: "power2.out",
			},
			4.3,
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
				ease: "power2.inOut",
			},
			4.3,
		);
		// ---------------------------------------------------------
		// 7. REVEAL SCREENS
		// ---------------------------------------------------------

		tl.call(
			() => {
				this.areScreensRevealed = true;

				if (this.youtubeScreen) {
					this.youtubeScreen.visible = true;
				}

				this.presenterScreens.forEach((screen) => {
					screen.visible = true;
				});
			},
			[],
			3.2,
		);
	}

	/* -------------------------------------------------------------
     SWITCH BETWEEN 3 BEST SEAT POVS (LEFT, CENTER, RIGHT)
  ------------------------------------------------------------- */
	public switchPov(newPov: PovPosition, onComplete?: () => void) {
		if (this.currentState === "ENTERING") return;
		this.startContinuousRendering();
		this.currentPov = newPov;
		const config = POV_PRESETS[newPov];
		if (!config) return;

		this.currentState = "CHANGING_SEAT";
		this.callbacks.onStateChange("CHANGING_SEAT");
		this.updateActivePovVisual(newPov);

		// Smoothly glide camera from current POV to target POV in 1.1s
		gsap.to(this.camera.position, {
			x: config.position.x,
			y: config.position.y,
			z: config.position.z,
			duration: 1.1,
			ease: "power2.inOut",
			onComplete: () => {
				this.currentState = "SEATED";
				this.callbacks.onStateChange("SEATED");
				this.updateActivePovVisual(newPov);
				this.callbacks.onPovChange(newPov);
				this.stopContinuousRendering();
				this.requestRender();
				if (onComplete) onComplete();
			},
		});

		// Align gaze directly straight-on at presentation screen
		gsap.to(this.currentLookAt, {
			x: config.lookAt.x,
			y: config.lookAt.y,
			z: config.lookAt.z,
			duration: 1.1,
			ease: "power2.inOut",
		});
	}

	/* -------------------------------------------------------------
     SET CAMERA VIEW MODES (POV, OVERVIEW, LOBBY)
  ------------------------------------------------------------- */
	public setViewMode(mode: "POV" | "OVERVIEW" | "LOBBY") {
		if (this.currentState === "ENTERING") return;

		if (mode === "POV") {
			this.switchPov(this.currentPov);
		} else if (mode === "OVERVIEW") {
			this.startContinuousRendering();
			this.currentState = "OVERVIEW";
			this.callbacks.onStateChange("OVERVIEW");
			this.updateActivePovVisual(this.currentPov);

			gsap.to(this.camera.position, {
				x: 0,
				y: 13.0,
				z: 26,
				duration: 1.6,
				ease: "power2.inOut",
			});
			// gsap.to(this.currentLookAt, {
			// 	x: 0,
			// 	y: 4.5,
			// 	z: 0,
			// 	duration: 1.6,
			// 	ease: "power2.inOut",
			// });
			gsap.to(this.currentLookAt, {
				x: 0,
				y: 4.5,
				z: 0,
				duration: 1.6,
				ease: "power2.inOut",

				onComplete: () => {
					this.stopContinuousRendering();
					this.requestRender();
				},
			});
		} else if (mode === "LOBBY") {
			// ---------------------------------------------------------
			// STOP YOUTUBE VIDEO WHEN USER EXITS AUDITORIUM
			// ---------------------------------------------------------
			this.stopYouTubeVideo();
			this.stopPresenterVideo();

			this.currentState = "LOBBY";
			this.callbacks.onStateChange("LOBBY");
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
			this.startContinuousRendering();
			gsap.to(this.camera.position, {
				x: lobbyCamera.position.x,
				y: lobbyCamera.position.y,
				z: lobbyCamera.position.z,
				duration: 1.6,
				ease: "power2.inOut",
			});

			gsap.to(this.currentLookAt, {
				x: lobbyCamera.lookAt.x,
				y: lobbyCamera.lookAt.y,
				z: lobbyCamera.lookAt.z,
				duration: 1.6,
				ease: "power2.inOut",
				onComplete: () => {
					this.stopContinuousRendering();
					this.requestRender();
				},
			});
		}
	}

	/* -------------------------------------------------------------
     LIGHTING PRESETS
  ------------------------------------------------------------- */
	public setLightingMode(mode: "PRESENTATION" | "HOUSE" | "CYBER") {
		this.startContinuousRendering();
		if (mode === "PRESENTATION") {
			gsap.to(this.ambientLight, { intensity: 0.75, duration: 1 });
			gsap.to(this.houseLight, { intensity: 0.35, duration: 1 });
			gsap.to(this.stageSpot1, { intensity: 5.5, duration: 1 });
			gsap.to(this.stageSpot2, {
				intensity: 5.0,
				duration: 1,
				onComplete: () => {
					this.stopContinuousRendering();
					this.requestRender();
				},
			});
		} else if (mode === "HOUSE") {
			gsap.to(this.ambientLight, { intensity: 1.4, duration: 1 });
			gsap.to(this.houseLight, { intensity: 1.2, duration: 1 });
			gsap.to(this.stageSpot1, { intensity: 3.0, duration: 1 });
			gsap.to(this.stageSpot2, {
				intensity: 3.0,
				duration: 1,
				onComplete: () => {
					this.stopContinuousRendering();
					this.requestRender();
				},
			});
		} else if (mode === "CYBER") {
			gsap.to(this.ambientLight, { intensity: 0.45, duration: 1 });
			gsap.to(this.houseLight, { intensity: 0.15, duration: 1 });
			gsap.to(this.stageSpot1, { intensity: 7.5, duration: 1 });
			gsap.to(this.stageSpot2, {
				intensity: 7.5,
				duration: 1,
				onComplete: () => {
					this.stopContinuousRendering();
					this.requestRender();
				},
			});
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
		if (this.currentState === "SEATED" && this.isMouseLooking) {
			this.mouseOffset.x = this.mouse.x * 0.3;
			this.mouseOffset.y = this.mouse.y * 0.15;
		} else {
			this.mouseOffset.x = 0;
			this.mouseOffset.y = 0;
		}

		if (this.currentState === "LOBBY") {
			this.raycaster.setFromCamera(this.mouse, this.camera);
			const intersects = this.raycaster.intersectObjects(
				this.interactiveObjects,
				true,
			);
			if (intersects.length > 0 && intersects[0].object.userData.isGate) {
				document.body.style.cursor = "pointer";
				this.callbacks.onGateHover(true);
				this.requestRender();
				return;
			}
		}

		document.body.style.cursor = "default";
		this.callbacks.onGateHover(false);
		this.requestRender();
	}

	private onClick(event: MouseEvent) {
		const rect = this.container.getBoundingClientRect();
		this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

		if (this.currentState === "LOBBY") {
			this.raycaster.setFromCamera(this.mouse, this.camera);
			const intersects = this.raycaster.intersectObjects(
				this.interactiveObjects,
				true,
			);
			if (intersects.length > 0 && intersects[0].object.userData.isGate) {
				this.enterAuditorium("CENTER");
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
		if (this.currentState === "LOBBY") {
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
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.requestRender();
	}

	/* -------------------------------------------------------------
     RENDER LOOP
  ------------------------------------------------------------- */
	private animate() {
		if (this.isDestroyed) return;

		// -------------------------------------------------------------
		// ONE FRAME
		// -------------------------------------------------------------

		this.needsRender = false;

		// -------------------------------------------------------------
		// CAMERA LOOK TARGET
		// -------------------------------------------------------------

		this.lookTarget.set(
			this.currentLookAt.x + this.mouseOffset.x * 1.2,
			this.currentLookAt.y + this.mouseOffset.y * 0.6,
			this.currentLookAt.z,
		);

		this.camera.lookAt(this.lookTarget);

		// -------------------------------------------------------------
		// YOUTUBE / PRESENTER SCREEN OCCLUSION
		// -------------------------------------------------------------

		const now = performance.now();

		if (this.currentState === "LOBBY") {
			if (this.youtubeScreen) {
				this.youtubeScreen.visible = false;
			}

			this.presenterScreens.forEach((screen) => {
				screen.visible = false;
			});

			this.areScreensRevealed = false;
			this.lastScreenVisibilityCheck = 0;
		} else if (this.currentState === "ENTERING") {
			// During the entrance cinematic, keep screens hidden
			// until the timeline explicitly reveals them.
			if (!this.areScreensRevealed) {
				if (this.youtubeScreen) {
					this.youtubeScreen.visible = false;
				}

				this.presenterScreens.forEach((screen) => {
					screen.visible = false;
				});
			}
		} else if (this.currentState === "SEATED") {
			if (this.youtubeScreen) {
				this.youtubeScreen.visible = true;
			}

			this.presenterScreens.forEach((screen) => {
				screen.visible = true;
			});

			this.lastScreenVisibilityCheck = now;
		} else if (this.youtubeScreen || this.presenterScreens.size > 0) {
			if (
				now - this.lastScreenVisibilityCheck >=
				this.screenVisibilityInterval
			) {
				this.lastScreenVisibilityCheck = now;

				if (this.youtubeScreen) {
					this.youtubeScreen.visible =
						this.isScreenVisibleFromCamera();
				}

				this.presenterScreens.forEach((screen) => {
					screen.visible =
						this.isPresenterScreenVisibleFromCamera(screen);
				});
			}
		}

		// -------------------------------------------------------------
		// WEBGL RENDER
		// -------------------------------------------------------------

		this.renderer.render(this.scene, this.camera);

		// -------------------------------------------------------------
		// CSS3D RENDER
		// -------------------------------------------------------------

		this.cssRenderer.render(this.scene, this.camera);
		// -------------------------------------------------------------
		// CONTINUOUS ANIMATION
		// -------------------------------------------------------------

		if (this.isContinuousAnimationActive) {
			this.animationFrameId = requestAnimationFrame(() => this.animate());
		} else {
			// IMPORTANT:
			// No requestAnimationFrame here.
			// The renderer goes to sleep.
			this.isRenderLoopRunning = false;
			this.animationFrameId = null;
		}
	}
	private requestRender() {
		if (this.isDestroyed) return;

		// A frame is already scheduled.
		if (this.isRenderLoopRunning) {
			this.needsRender = true;
			return;
		}

		this.needsRender = true;
		this.isRenderLoopRunning = true;

		this.animationFrameId = requestAnimationFrame(() => this.animate());
	}
	private startContinuousRendering() {
		if (this.isDestroyed) return;

		this.isContinuousAnimationActive = true;

		if (this.isRenderLoopRunning) return;

		this.isRenderLoopRunning = true;

		this.animationFrameId = requestAnimationFrame(() => this.animate());
	}

	private stopContinuousRendering() {
		this.isContinuousAnimationActive = false;
	}

	public destroy() {
		this.isDestroyed = true;
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
		}
		window.removeEventListener("resize", this.onWindowResize);
		window.removeEventListener("pointermove", this.onPointerMove);
		window.removeEventListener("click", this.onClick);
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}

		if (this.renderer.domElement.parentElement) {
			this.renderer.domElement.parentElement.removeChild(
				this.renderer.domElement,
			);
		}

		if (this.cssRenderer?.domElement.parentElement) {
			this.cssRenderer.domElement.parentElement.removeChild(
				this.cssRenderer.domElement,
			);
		}

		this.renderer.dispose();
	}
}
