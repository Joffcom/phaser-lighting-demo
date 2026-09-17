import { Scene, BlendModes, Math as PhaserMath } from 'phaser';
import { Dungeon, generateDungeon, TILE_SIZE } from '../dungeon/generate';
import { Visibility } from '../lighting/Visibility';

const MAP_TILES_WIDE = 40; // 640 / 16, matches Reg.width from the original demo
const MAP_TILES_HIGH = 30; // 480 / 16, matches Reg.height from the original demo
const WORLD_WIDTH = MAP_TILES_WIDE * TILE_SIZE;
const WORLD_HEIGHT = MAP_TILES_HIGH * TILE_SIZE;

const GLOW_DISPLAY_SIZE = 200;

export class Game extends Scene {
    private dungeon!: Dungeon;
    private visibility!: Visibility;

    // The darkness overlay is erased with the visibility polygon directly
    // (not a masked sprite) because Phaser 4 dropped WebGL support for
    // GeometryMask - see Phaser.Display.Masks.GeometryMask's own docs,
    // which point WebGL users at the (texture-based) Filters system
    // instead. Drawing/erasing a Graphics object needs no mask at all, so
    // this sidesteps the issue and gives pixel-exact wall occlusion.
    private darkness!: Phaser.GameObjects.RenderTexture;
    private visibilityPolygon!: Phaser.GameObjects.Graphics;
    private glow!: Phaser.GameObjects.Image;
    private cursorDot!: Phaser.GameObjects.Rectangle;

    // The lamp follows the mouse, but only across floor tiles - the
    // dungeon's unbuilt "background" is solid rock, not open air, so
    // wandering the cursor over it would otherwise flood a huge stretch of
    // unbounded space with light (there's nothing there to stop it). When
    // the pointer strays off the floor the lamp just stays put.
    private lightX = 0;
    private lightY = 0;

    // "F" toggles the darkness overlay off entirely, revealing the whole
    // generated dungeon at once.
    private fullBright = false;

    constructor() {
        super('Game');
    }

    preload(): void {
        this.load.setPath('assets');
        this.load.image('tileset', 'tileset.png');
        this.load.image('light', 'light.png');
    }

    create(): void {
        this.buildDungeon();
        this.setupLighting();
        this.setupHelpText();

        this.input.keyboard?.on('keydown-ESC', () => this.scene.restart());
        this.input.keyboard?.on('keydown-F', () => {
            this.fullBright = !this.fullBright;
        });
    }

    private buildDungeon(): void {
        const dungeon = generateDungeon(MAP_TILES_WIDE, MAP_TILES_HIGH);
        this.dungeon = dungeon;
        this.lightX = dungeon.startX;
        this.lightY = dungeon.startY;

        const map = this.make.tilemap({
            data: dungeon.tiles,
            tileWidth: TILE_SIZE,
            tileHeight: TILE_SIZE,
        });
        const tileset = map.addTilesetImage('tileset', 'tileset', TILE_SIZE, TILE_SIZE)!;
        map.createLayer(0, tileset, 0, 0);

        this.visibility = new Visibility();
        this.visibility.loadMap(Math.max(WORLD_WIDTH, WORLD_HEIGHT));
        for (const wall of dungeon.wallSegments) {
            this.visibility.addSegment(wall.x1, wall.y1, wall.x2, wall.y2);
        }

        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }

    private setupLighting(): void {
        // Soft warm lamp glow, added to the scene like any normal sprite -
        // no mask needed. Its own radial falloff is unclipped, but it sits
        // *below* the opaque darkness layer (depth 500 vs 1000), so it is
        // only ever visible through the hole erase() punches out of that
        // darkness each frame - the darkness fully hides it everywhere else.
        this.glow = this.add.image(0, 0, 'light');
        this.glow.setDisplaySize(GLOW_DISPLAY_SIZE, GLOW_DISPLAY_SIZE);
        this.glow.setBlendMode(BlendModes.SCREEN);
        this.glow.setAlpha(0.35);
        this.glow.setTint(0xffb066);
        this.glow.setDepth(500);

        // Off-display-list Graphics used purely as an erase stamp - never
        // rendered directly, only read by RenderTexture.erase() below.
        this.visibilityPolygon = this.make.graphics({}, false);

        this.darkness = this.add.renderTexture(0, 0, WORLD_WIDTH, WORLD_HEIGHT).setOrigin(0, 0).setDepth(1000);

        this.cursorDot = this.add.rectangle(0, 0, 2, 2, 0xff0000).setDepth(1001);
    }

    private setupHelpText(): void {
        this.add
            .text(8, 8, 'Move the mouse to carry the lamp - ESC regenerates the dungeon - F toggles the lights', {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#ffffff',
                backgroundColor: '#00000080',
                padding: { x: 6, y: 4 },
            })
            .setScrollFactor(0)
            .setDepth(1002);
    }

    update(): void {
        const pointer = this.input.activePointer;
        const pointerX = PhaserMath.Clamp(pointer.worldX, 0, WORLD_WIDTH - 1);
        const pointerY = PhaserMath.Clamp(pointer.worldY, 0, WORLD_HEIGHT - 1);
        const tileX = Math.floor(pointerX / TILE_SIZE);
        const tileY = Math.floor(pointerY / TILE_SIZE);

        if (this.dungeon.isFloor(tileX, tileY)) {
            this.lightX = pointerX;
            this.lightY = pointerY;
        }

        this.glow.setPosition(this.lightX, this.lightY);
        this.cursorDot.setPosition(this.lightX, this.lightY);

        this.darkness.clear();

        if (!this.fullBright) {
            this.visibility.setLightLocation(this.lightX, this.lightY);
            this.visibility.sweep();

            this.visibilityPolygon.clear();
            this.visibilityPolygon.fillStyle(0xffffff, 1);
            this.visibilityPolygon.fillPoints(this.visibility.output, true, true);

            this.darkness.fill(0x000000, 1);
            this.darkness.erase(this.visibilityPolygon, 0, 0);
        }

        // RenderTexture draw commands are buffered in Phaser 4; render() flushes them to pixels.
        this.darkness.render();
    }
}
