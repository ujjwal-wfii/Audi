import * as THREE from "three";
import gsap from "gsap";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { SeatData, SceneState } from "@/types/auditorium";
import { STAGE_CENTER, ROW_CONFIGS, FIRST_ROW_Z, ROW_SPACING } from "@/utils/seatLayout";
import {
	createKeynoteScreenTexture,
	createEntranceSignTexture,
	createDoorSignTexture,
	createWoodStageTexture,
	createMarbleTexture,
} from "@/utils/textureGenerator";
import {
	CSS3DRenderer,
	CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const gateZ = 32;
const lastRowIndex = ROW_CONFIGS.length - 1;
const lastRowElevation = ROW_CONFIGS[lastRowIndex].elevation;
const lastRowEdge = FIRST_ROW_Z + (lastRowIndex + 0.5) * ROW_SPACING;
const rearStepCount = Math.ceil((gateZ - lastRowEdge) / ROW_SPACING);
const rearStepDepth = (gateZ - lastRowEdge) / rearStepCount;
const rearStepRise = lastRowElevation - ROW_CONFIGS[lastRowIndex - 1].elevation;
const lobbyElevation = lastRowElevation + rearStepCount * rearStepRise;

const desktopLobby = {
	position: new THREE.Vector3(0, lobbyElevation + 2.2, 38),
	focus: new THREE.Vector3(0, lobbyElevation + 2.2, 30),
};
const portraitLobby = {
	position: new THREE.Vector3(0, lobbyElevation + 2.6, 36),
	focus: new THREE.Vector3(0, lobbyElevation + 2.7, 30),
};

// Reference composition: a level rear-center view, with the screen spanning
// 51% of the width at the reference image's 2:1 aspect ratio.
const seatedPosition = new THREE.Vector3(0, 7.9, 26.5);
const seatedFocus = new THREE.Vector3(0, 7.9, -8.5);
const screenWidth = 28;
const screenHeight = 12.6;
const stageHeight = 1.2;
const screenCenterY = 1.6 + screenHeight / 2;

export interface SceneCallbacks {
	onStateChange: (state: SceneState) => void;
}

export class AuditoriumScene {
	private container: HTMLElement;
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private renderer: THREE.WebGLRenderer;
	private cssRenderer: CSS3DRenderer;
	private youtubeScreen: CSS3DObject | null = null;
	private youtubePlayer: any = null;
	private isYouTubeReady = false;
	private shouldPlayYouTube = false;
	// Independent presenter screens. Each can load different content.
	private presenterScreens: Map<"LEFT" | "RIGHT", CSS3DObject> = new Map();
	private callbacks: SceneCallbacks;

	// State
	private currentState: SceneState = "LOBBY";
	private mouse = new THREE.Vector2();
	private currentLookAt = desktopLobby.focus.clone();

	// 3D Objects & Meshes
	private tierMeshes: THREE.Mesh[] = [];
	private leftDoorGroup: THREE.Group = new THREE.Group();
	private rightDoorGroup: THREE.Group = new THREE.Group();
	private gateHitbox: THREE.Mesh | null = null;
	private raycaster = new THREE.Raycaster();
	private interactiveObjects: THREE.Object3D[] = [];
	private screenRaycaster = new THREE.Raycaster();
	private screenOccluders: THREE.Object3D[] = [];
	private readonly cameraWorldPosition = new THREE.Vector3();

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
	private ceilingTexture?: THREE.Texture;
	private carpetMaterial?: THREE.MeshStandardMaterial;
	private sideWallTexture?: THREE.Texture;
	private backWallTexture?: THREE.Texture;
	// Observes the actual canvas/container size.
	// More reliable than relying only on window resize events.
	private resizeObserver: ResizeObserver | null = null;
	private readonly referenceAspect = 16 / 9;
	private readonly referenceFov = 60;
	private rightImageScreen: CSS3DObject | null = null;

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

		this.camera = new THREE.PerspectiveCamera(
			this.referenceFov,
			width / height,
			0.05,
			200,
		);
		// Initial camera in Lobby
		const lobby = height > width ? portraitLobby : desktopLobby;
		this.camera.position.copy(lobby.position);
		this.currentLookAt.copy(lobby.focus);
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
		lobbyLight.position.set(0, lobbyElevation + 4.5, 36);
		this.scene.add(lobbyLight);
	}
	// load the YouTube IFrame API and initialize the player
	private loadYouTubeAPI(iframe: HTMLIFrameElement, videoId: string) {
		const initializePlayer = () => {
			this.youtubePlayer = new (window as any).YT.Player(iframe, {
				events: {
					onReady: () => {
						this.isYouTubeReady = true;

						if (
							this.shouldPlayYouTube &&
							this.currentState === "SEATED"
						) {
							this.youtubePlayer.playVideo();
						}
					},

					onStateChange: (event: any) => {
						console.log("YouTube state:", event.data);
					},

					onError: (event: any) => {
						console.error("YouTube player error:", event.data);
					},
				},
			});
		};

		if ((window as any).YT && (window as any).YT.Player) {
			initializePlayer();
			return;
		}

		const existingScript = document.querySelector(
			'script[src="https://www.youtube.com/iframe_api"]',
		);

		if (!existingScript) {
			const script = document.createElement("script");

			script.src = "https://www.youtube.com/iframe_api";

			document.head.appendChild(script);
		}

		(window as any).onYouTubeIframeAPIReady = initializePlayer;
	}
	// -------------------------------------------------------------
	// YOUTUBE LIVE VIDEO ON THE REAL 3D SCREEN
	// -------------------------------------------------------------
	private createYouTubeScreen() {

		const youtubeVideoId = process.env.NEXT_PUBLIC_YOUTUBE_VIDEO_ID_1 || "WjSNkTVHB88";

		const wrapper = document.createElement("div");

		const cssWidth = 1000;
		const cssHeight = cssWidth * (screenHeight / screenWidth);

		wrapper.style.width = `${cssWidth}px`;
		wrapper.style.height = `${cssHeight}px`;
		wrapper.style.background = "#000";
		wrapper.style.overflow = "hidden";
		wrapper.style.boxSizing = "border-box";
		wrapper.style.borderRadius = "18px";
		wrapper.style.pointerEvents = "none";

		const iframe = document.createElement("iframe");

		iframe.id = "youtube-main-screen";

		iframe.src =
			`https://www.youtube.com/embed/${youtubeVideoId}` +
			`?autoplay=0` +
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

		videoObject.position.set(0, screenCenterY, -8.49);

		videoObject.rotation.set(0, 0, 0);

		const worldScale = screenWidth / cssWidth;

		videoObject.scale.set(worldScale, worldScale, worldScale);

		this.youtubeScreen = videoObject;

		this.scene.add(videoObject);

		this.loadYouTubeAPI(iframe, youtubeVideoId);
	}
	// -------------------------------------------------------------
	// STOP YOUTUBE LIVE VIDEO
	// -------------------------------------------------------------
	private stopYouTubeVideo() {
		this.shouldPlayYouTube = false;
		this.isYouTubeReady = false;

		if (this.youtubePlayer) {
			try {
				this.youtubePlayer.stopVideo();
				this.youtubePlayer.destroy();
			} catch (error) {
				console.warn("Failed to destroy YouTube player:", error);
			}

			this.youtubePlayer = null;
		}

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
		"LEFT",
		{
			videoId: string;
			x: number;
			y?: number;
			z: number;
		}
	> = {
		LEFT: {
			videoId: process.env.NEXT_PUBLIC_PRESENTER_VIDEO_ID || "yZrV-5vvZSE",
			x: -14.8,
			z: -3,
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
	private createRightImageScreen() {
		const screenWidth = 4;
		const screenHeight = 7.1111;

		const cssWidth = 500;
		const cssHeight = 888.89;

		const wrapper = document.createElement("div");

		wrapper.style.width = `${cssWidth}px`;
		wrapper.style.height = `${cssHeight}px`;

		wrapper.style.background = "#000";

		wrapper.style.overflow = "hidden";

		// SAME UI / FRAME AS OLD PRESENTER SCREEN
		wrapper.style.border = "3px solid #171114";

		wrapper.style.boxSizing = "border-box";

		wrapper.style.borderRadius = "0";

		wrapper.style.pointerEvents = "none";

		// ---------------------------------------
		// IMAGE CONTAINER
		// ---------------------------------------

		const imageContainer = document.createElement("div");

		imageContainer.style.width = "100%";
		imageContainer.style.height = "100%";

		imageContainer.style.display = "flex";
		imageContainer.style.flexDirection = "column";

		// Partition between images
		imageContainer.style.gap = "6px";

		imageContainer.style.background = "#5c3822";

		// ---------------------------------------
		// THREE IMAGES
		// ---------------------------------------

		const images = ["/logo1.jpeg", "/logo.png", "/logo1.jpeg"];

		images.forEach((src) => {
			const image = document.createElement("img");

			image.src = src;

			image.style.width = "100%";

			// Account for the two 6px partitions
			image.style.height = "calc((100% - 12px) / 3)";

			image.style.display = "block";

			image.style.objectFit = "cover";

			image.style.flexShrink = "0";

			imageContainer.appendChild(image);
		});

		wrapper.appendChild(imageContainer);

		// ---------------------------------------
		// CSS3D OBJECT
		// ---------------------------------------

		const imageScreen = new CSS3DObject(wrapper);

		imageScreen.position.set(18.2, 8.6, -8.3);

		imageScreen.rotation.set(0, 0, 0);

		const worldScale = screenWidth / cssWidth;

		imageScreen.scale.set(worldScale, worldScale, worldScale);

		imageScreen.visible = false;

		this.scene.add(imageScreen);

		return imageScreen;
	}
	private createPresenterScreen(
		side: "LEFT",
		videoId = this.presenterScreenConfig[side].videoId,
	) {
		const screenWidth = 4;
		const screenHeight = 7.1111;
		const config = this.presenterScreenConfig[side];

		const wrapper = document.createElement("div");

		const cssWidth = 500;
		const cssHeight = 888.89;

		wrapper.style.width = `${cssWidth}px`;
		wrapper.style.height = `${cssHeight}px`;
		wrapper.style.background = "#000";
		wrapper.style.overflow = "hidden";
		wrapper.style.border = "3px solid #171114";
		wrapper.style.boxSizing = "border-box";
		wrapper.style.borderRadius = "0";
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
			config.x+1,
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

		if (this.presenterScreenConfig.LEFT.videoId) this.createPresenterScreen("LEFT");

		this.rightImageScreen = this.createRightImageScreen();
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
     STAGE & AUDITORIUM HALL
  ------------------------------------------------------------- */
	private buildAuditoriumHall() {
		const woodTexture = createWoodStageTexture();

		// 1. Stage Platform
		const stageWidth = 34;
		const stageDepth = 7.6;

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
		stage.position.set(STAGE_CENTER.x, stageHeight / 2, -5.4);
		stage.receiveShadow = true;
		this.scene.add(stage);
		this.addScreenOccluder(stage);


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
		// The lower edge sits above the stage deck.
		this.screenMesh.position.set(0, screenCenterY, -8.5);

		this.screenMesh.rotation.y = 0;

		this.scene.add(this.screenMesh);

		this.buildHallSurfaces();
		this.buildStageDetails();
		this.loadStagePlants();

		const carpetPath = "/textures/stalls/";
		const configureCarpetMap = (texture: THREE.Texture) => {
			if (this.isDestroyed) return;
			texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
			texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
			texture.generateMipmaps = true;
			texture.minFilter = THREE.LinearMipmapLinearFilter;
			texture.needsUpdate = true;
			this.requestRender();
		};
		const exr = new EXRLoader().setPath(carpetPath);
		const carpetColor = new THREE.TextureLoader().setPath(carpetPath).load("floor_color.jpg", configureCarpetMap);
		carpetColor.colorSpace = THREE.SRGBColorSpace;
		const carpetNormal = exr.load("dirty_carpet_nor_gl_1k.exr", configureCarpetMap);
		const carpetRoughness = exr.load("dirty_carpet_rough_1k.exr", configureCarpetMap);
		const tierCarpetMat = new THREE.MeshStandardMaterial({
			map: carpetColor,
			normalMap: carpetNormal,
			normalScale: new THREE.Vector2(0.7, 0.7),
			roughnessMap: carpetRoughness,
		});
		this.carpetMaterial = tierCarpetMat;

		// Match the stall carpet's 0.65-unit tile on both broad floors and narrow treads.
		const tileCarpet = (geometry: THREE.BoxGeometry | THREE.PlaneGeometry) => {
			const { width, height } = geometry.parameters;
			const depth = "depth" in geometry.parameters ? geometry.parameters.depth : 0;
			const uv = geometry.getAttribute("uv");
			const normal = geometry.getAttribute("normal");
			for (let i = 0; i < uv.count; i++) {
				const faceWidth = normal.getX(i) ? depth : width;
				const faceHeight = normal.getY(i) ? depth : height;
				uv.setXY(i, uv.getX(i) * faceWidth / 0.65, uv.getY(i) * faceHeight / 0.65);
			}
		};

		const tierFrontMat = new THREE.MeshStandardMaterial({
			color: 0x6b4f2a,
			roughness: 0.6,
		});

		const stepAmberMat = new THREE.MeshBasicMaterial({
			color: 0xf59e0b,
		});

		// Same values as the new straight seat layout
		const seatingWidth = 35.0;
		const addTier = (z: number, elevation: number, rowDepth: number, fasciaHeight: number) => {
			// --------------------------------
			// ROW PLATFORM
			// --------------------------------

			const platformGeo = new THREE.BoxGeometry(
				seatingWidth,
				0.15,
				rowDepth,
			);

			tileCarpet(platformGeo);
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
		};

		ROW_CONFIGS.forEach(({ elevation }, idx) => {
			const rise = elevation - (idx === 0 ? 0 : ROW_CONFIGS[idx - 1].elevation);
			addTier(FIRST_ROW_Z + idx * ROW_SPACING, elevation, ROW_SPACING, rise);
		});
		for (let i = 1; i <= rearStepCount; i++) {
			addTier(lastRowEdge + (i - 0.5) * rearStepDepth,
				lastRowElevation + i * rearStepRise, rearStepDepth, rearStepRise);
		}
		this.tierMeshes.forEach((mesh) => {
			this.addScreenOccluder(mesh);
		});
		// 6. Solid Flat Ground Floor
		const groundFloorGeo = new THREE.PlaneGeometry(50, 43);
		tileCarpet(groundFloorGeo);
		const groundFloorMesh = new THREE.Mesh(groundFloorGeo, tierCarpetMat);
		groundFloorMesh.rotation.x = -Math.PI / 2;
		groundFloorMesh.position.set(0, 0, 10.5);
		this.scene.add(groundFloorMesh);

	}

	// Each inward-facing plane has independent material and full-image UVs.
	// Assign an sRGB image to its material.map to dress that surface.
	private buildHallSurfaces() {
		const halfWidth = 22.5;
		const height = 15.8;
		const backZ = -10;
		const depth = gateZ - backZ;
		const middleZ = (gateZ + backZ) / 2;
		const panel = (name: string, width: number, length: number, color: number) => {
			const material = new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
			const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
			mesh.name = material.name = name;
			this.scene.add(mesh);
			return mesh;
		};
		const back = panel("stage-back-wall", 2 * halfWidth, height, 0x413438);
		back.position.set(0, height / 2, backZ);
		this.backWallTexture = new THREE.TextureLoader().load(
			"/textures/walls/auditorium-cream-panels.png",
			(texture) => {
				if (this.isDestroyed) return;
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
				back.material.color.setHex(0xffffff);
				back.material.map = texture;
				back.material.needsUpdate = true;
				this.requestRender();
			},
		);
		const wallMaterials: THREE.MeshStandardMaterial[] = [];
		for (const side of [-1, 1]) {
			const wall = panel(side < 0 ? "left-wall" : "right-wall", depth, height, 0x825745);
			wall.position.set(side * halfWidth, height / 2, middleZ);
			wall.rotation.y = -side * Math.PI / 2;
			wallMaterials.push(wall.material);
		}
		this.sideWallTexture = new THREE.TextureLoader().load(
			"/textures/walls/auditorium-warm-slats.png",
			(texture) => {
				if (this.isDestroyed) return;
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
				for (const material of wallMaterials) {
					material.color.setHex(0xffffff);
					material.map = texture;
					material.emissiveMap = texture;
					material.emissive.setHex(0xffffff);
					material.emissiveIntensity = 0.22;
					material.needsUpdate = true;
				}
				this.requestRender();
			},
		);
		const ceiling = panel("ceiling", 2 * halfWidth, depth, 0xa78272);
		ceiling.rotation.x = Math.PI / 2;
		ceiling.position.set(0, height, middleZ);
		this.ceilingTexture = new THREE.TextureLoader().load(
			"/textures/ceiling/auditorium-warm-beige.png",
			(texture) => {
				if (this.isDestroyed) return;
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
				ceiling.material.color.setHex(0xffffff);
				ceiling.material.map = texture;
				// The supplied image already includes the cove and downlight glow.
				ceiling.material.emissiveMap = texture;
				ceiling.material.emissive.setHex(0xffffff);
				ceiling.material.emissiveIntensity = 0.35;
				ceiling.material.needsUpdate = true;
				this.requestRender();
			},
		);
	}

	private buildStageDetails() {
		const trim = new THREE.MeshBasicMaterial({ color: 0xffb36c });
		const timber = new THREE.MeshStandardMaterial({ color: 0x71482f, roughness: 0.6 });
		const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
			const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
			mesh.position.set(x, y, z);
			this.scene.add(mesh);
		};
		// Stage lip and shallow side stairs.
		box(34, 0.09, 0.08, 0, 1.17, -1.58, trim);
		const fascia = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 1.05, 0.055), timber, 275);
		const transform = new THREE.Matrix4();
		for (let i = 0; i < fascia.count; i++) {
			fascia.setMatrixAt(i, transform.makeTranslation(-16.92 + i * 0.123, 0.55, -1.59));
		}
		this.scene.add(fascia);
		for (const side of [-1, 1]) {
			for (let i = 0; i < 6; i++) {
				const height = (i + 1) * 0.2;
				const z = -1.8 - i * 0.6;
				box(4, height, 0.6, side * 19, height / 2, z, timber);
				box(4, 0.035, 0.04, side * 19, height, z + 0.3, trim);
			}
		}
		// for (const side of [-1, 1]) {
		// 	// Warm pools of light give the flat panels depth before artwork is added.
		// 	const wash = new THREE.PointLight(0xffb16a, 75, 18, 2);
		// 	wash.position.set(side * 18.6, 1.5, -7);
		// 	this.scene.add(wash);
		// }

	}

	private loadStagePlants() {
		const decoder = new DRACOLoader().setDecoderPath("/draco/");
		const loader = new GLTFLoader().setDRACOLoader(decoder);
		loader.load("/models/plant-draco.glb", ({ scene: plant }) => {
			decoder.dispose();
			if (this.isDestroyed) return;
			plant.scale.setScalar(5);
			const bounds = new THREE.Box3().setFromObject(plant);
			for (const side of [-1, 1]) {
				const instance = plant.clone();
				instance.name = side < 0 ? "stage-plant-left" : "stage-plant-right";
				instance.position.set(side * 18.6, -bounds.min.y, -7.8);
				this.scene.add(instance);
			}
			this.requestRender();
		}, undefined, (error) => {
			decoder.dispose();
			console.error("Could not load auditorium plants:", error);
		});
	}

	/* -------------------------------------------------------------
     ENTRANCE LOBBY & INTERACTIVE GATE
  ------------------------------------------------------------- */
	private buildEntranceLobby() {
		const lobby = new THREE.Group();
		lobby.position.y = lobbyElevation;
		this.scene.add(lobby);

		const marbleTex = createMarbleTexture();
		marbleTex.repeat.y *= 16 / 20;
		const foyerFloorMat = new THREE.MeshStandardMaterial({
			map: marbleTex,
			roughness: 0.2,
			metalness: 0.2,
		});
		const foyerFloor = new THREE.Mesh(
			new THREE.PlaneGeometry(26, 16),
			foyerFloorMat,
		);
		foyerFloor.rotation.x = -Math.PI / 2;
		foyerFloor.position.set(0, 0, gateZ + 8);
		lobby.add(foyerFloor);

		const wallMat = new THREE.MeshStandardMaterial({
			color: 0xe9e3d4,
			roughness: 0.6,
		});

		const leftWall = new THREE.Mesh(
			new THREE.BoxGeometry(9, 10, 0.6),
			wallMat,
		);
		leftWall.position.set(-7.5, 5, gateZ);
		lobby.add(leftWall);

		const rightWall = new THREE.Mesh(
			new THREE.BoxGeometry(9, 10, 0.6),
			wallMat,
		);
		rightWall.position.set(7.5, 5, gateZ);
		lobby.add(rightWall);

		const topWall = new THREE.Mesh(
			new THREE.BoxGeometry(7, 5.5, 0.6),
			wallMat,
		);
		topWall.position.set(0, 7.25, gateZ);
		lobby.add(topWall);

		const signTexture = createEntranceSignTexture();
		const signMat = new THREE.MeshBasicMaterial({ map: signTexture });
		const signMesh = new THREE.Mesh(
			new THREE.PlaneGeometry(3.8, 0.65),
			signMat,
		);
		signMesh.position.set(0, 4.8, gateZ + 0.35);
		lobby.add(signMesh);

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
		this.leftDoorGroup.position.set(-doorWidth, 0, gateZ);

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

		lobby.add(this.leftDoorGroup);

		this.rightDoorGroup = new THREE.Group();
		this.rightDoorGroup.position.set(doorWidth, 0, gateZ);

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

		lobby.add(this.rightDoorGroup);

		const gateHitboxGeo = new THREE.BoxGeometry(6.0, 5.0, 1.5);
		const gateHitboxMat = new THREE.MeshBasicMaterial({ visible: false });
		this.gateHitbox = new THREE.Mesh(gateHitboxGeo, gateHitboxMat);
		this.gateHitbox.position.set(0, 2.5, gateZ);
		this.gateHitbox.userData = { isGate: true };
		lobby.add(this.gateHitbox);
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
			color: 0x62433a,
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
			color: 0xffae58,
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
			seatGroup.position.set(seat.position.x, seat.position.y, seat.position.z);

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

			if (seat.number === 10 || seat.number === 11) {
				const isLeftAisle = seat.number === 11;

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
			// Add the seat to the audience bank
			// -------------------------------------------------------

			this.scene.add(seatGroup);

			this.freezeObjectMatrices(seatGroup);

		});

	}

	// added camera aspect for mobile portrait
	private updateCameraForAspect(width: number, height: number) {
		const aspect = width / height;

		// Desktop / landscape: keep the original 54° FOV.
		const inHall = this.currentState !== "LOBBY";
		const framingAspect = inHall ? 2 : this.referenceAspect;
		const verticalFov = inHall ? 43 : this.referenceFov;
		if (aspect >= framingAspect) {
			this.camera.fov = verticalFov;
		} else {
			// On narrower screens, increase vertical FOV
			// so the horizontal composition does not become
			// excessively cropped.
			const referenceHorizontalFov =
				2 *
				Math.atan(
					Math.tan((verticalFov * Math.PI) / 360) *
						framingAspect,
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
	public enterAuditorium(onComplete?: () => void) {
		this.startContinuousRendering();
		this.currentState = "ENTERING";
		this.callbacks.onStateChange("ENTERING");

		this.updateCameraForAspect(this.camera.aspect, 1);
		document.body.style.cursor = "default";

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

		const entryEyeHeight = this.camera.position.y;
		const landingCenterZ = gateZ - rearStepDepth / 2;
		const tl = gsap.timeline({
			onComplete: () => {
				this.currentState = "SEATED";

				this.callbacks.onStateChange("SEATED");


				this.shouldPlayYouTube = true;

				if (this.isYouTubeReady && this.youtubePlayer) {
					this.youtubePlayer.playVideo();
				}

				this.stopContinuousRendering();

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

		// Cross the level threshold, then descend along the aisle in one forward move.
		tl.to(
			this.camera.position,
			{
				z: seatedPosition.z,
				duration: 5.2,
				ease: "sine.inOut",
				onUpdate: () => {
					const heightFraction = THREE.MathUtils.smoothstep(
						this.camera.position.z, seatedPosition.z, landingCenterZ,
					);
					this.camera.position.y = THREE.MathUtils.lerp(seatedPosition.y, entryEyeHeight, heightFraction);
				},
			},
			0.5,
		);
		tl.to(
			this.currentLookAt,
			{
				x: seatedFocus.x,
				y: seatedFocus.y,
				z: seatedFocus.z,
				duration: 5.2,
				ease: "sine.inOut",
			},
			0.5,
		);

		tl.call(
			() => {
				this.areScreensRevealed = true;

				if (this.youtubeScreen) {
					this.youtubeScreen.visible = true;
				}

				this.presenterScreens.forEach((screen) => {
					screen.visible = true;
				});
				if (this.rightImageScreen) {
					this.rightImageScreen.visible = true;
				}
			},
			[],
			4.6,
		);
		tl.duration(4.7);
	}

	public exitToLobby() {
		if (this.currentState !== "SEATED") return;
		// Release the live screens as the lobby transition begins.
		this.stopYouTubeVideo();
		this.stopPresenterVideo();
		if (this.rightImageScreen) {
			this.rightImageScreen.visible = false;
		}

		this.currentState = "LOBBY";
		this.callbacks.onStateChange("LOBBY");
		this.updateCameraForAspect(this.camera.aspect, 1);

		// Close doors
		const tl = gsap.timeline();
		tl.to([this.leftDoorGroup.rotation, this.rightDoorGroup.rotation], { y: 0, duration: 1.0 }, 0);

		const width = this.container.clientWidth || window.innerWidth;
		const height = this.container.clientHeight || window.innerHeight;
		const isPortrait = height > width;

		const lobbyCamera = isPortrait ? portraitLobby : desktopLobby;
		this.startContinuousRendering();
		tl.to(this.camera.position, {
			x: lobbyCamera.position.x,
			y: lobbyCamera.position.y,
			z: lobbyCamera.position.z,
			duration: 1.6,
			ease: "power2.inOut",
		}, 0);

		tl.to(this.currentLookAt, {
			x: lobbyCamera.focus.x,
			y: lobbyCamera.focus.y,
			z: lobbyCamera.focus.z,
			duration: 1.6,
			ease: "power2.inOut",
			onComplete: () => {
				this.stopContinuousRendering();
				this.requestRender();
			},
		}, 0);
		tl.duration(3.1);
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
		if (this.currentState !== "LOBBY") return;
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
				document.body.style.cursor = "pointer";

				this.requestRender();
				return;
			}
		}

		document.body.style.cursor = "default";

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
				this.enterAuditorium();
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
			const lobby = height > width ? portraitLobby : desktopLobby;
			this.camera.position.copy(lobby.position);
			this.currentLookAt.copy(lobby.focus);
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

		this.camera.lookAt(this.currentLookAt);

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
		} else if (
			this.youtubeScreen ||
			this.presenterScreens.size > 0 ||
			this.rightImageScreen
		) {
			if (
				now - this.lastScreenVisibilityCheck >=
				this.screenVisibilityInterval
			) {
				this.lastScreenVisibilityCheck = now;

				if (this.youtubeScreen) {
					this.youtubeScreen.visible =
						this.isScreenVisibleFromCamera();
				}
				if (this.rightImageScreen) {
					this.rightImageScreen.visible =
						this.isPresenterScreenVisibleFromCamera(
							this.rightImageScreen,
						);
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

		this.ceilingTexture?.dispose();
		this.sideWallTexture?.dispose();
		this.backWallTexture?.dispose();
		this.carpetMaterial?.map?.dispose();
		this.carpetMaterial?.normalMap?.dispose();
		this.carpetMaterial?.roughnessMap?.dispose();
		this.carpetMaterial?.dispose();
		this.renderer.dispose();
	}
}
