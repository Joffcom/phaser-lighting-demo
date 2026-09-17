export const MIN_LEAF_SIZE = 10;
export const MAX_LEAF_SIZE = 20;

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (1 + max - min) + min);
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

function rectLeft(r: Rect): number { return r.x; }
function rectRight(r: Rect): number { return r.x + r.width; }
function rectTop(r: Rect): number { return r.y; }
function rectBottom(r: Rect): number { return r.y + r.height; }

export class Leaf {
    x: number;
    y: number;
    width: number;
    height: number;

    leftChild: Leaf | null = null;
    rightChild: Leaf | null = null;
    room: Rect | null = null;
    halls: Rect[] | null = null;

    constructor(x: number, y: number, width: number, height: number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    split(): boolean {
        if (this.leftChild || this.rightChild) {
            return false;
        }

        let splitH = Math.random() > 0.5;

        if (this.width > this.height && this.width / this.height >= 1.25) {
            splitH = false;
        } else if (this.height > this.width && this.height / this.width >= 1.25) {
            splitH = true;
        }

        const max = (splitH ? this.height : this.width) - MIN_LEAF_SIZE;
        if (max <= MIN_LEAF_SIZE) {
            return false;
        }

        const split = Math.floor(randomInt(MIN_LEAF_SIZE, max));

        if (splitH) {
            this.leftChild = new Leaf(this.x, this.y, this.width, split);
            this.rightChild = new Leaf(this.x, this.y + split, this.width, this.height - split);
        } else {
            this.leftChild = new Leaf(this.x, this.y, split, this.height);
            this.rightChild = new Leaf(this.x + split, this.y, this.width - split, this.height);
        }

        return true;
    }

    getRoom(): Rect | null {
        if (this.room) {
            return this.room;
        }

        const lRoom = this.leftChild ? this.leftChild.getRoom() : null;
        const rRoom = this.rightChild ? this.rightChild.getRoom() : null;

        if (!lRoom && !rRoom) return null;
        if (!rRoom) return lRoom;
        if (!lRoom) return rRoom;
        return Math.random() > 0.5 ? lRoom : rRoom;
    }

    createRooms(): void {
        if (this.leftChild || this.rightChild) {
            if (this.leftChild) this.leftChild.createRooms();
            if (this.rightChild) this.rightChild.createRooms();

            if (this.leftChild && this.rightChild) {
                this.createHall(this.leftChild.getRoom(), this.rightChild.getRoom());
            }
        } else {
            const roomWidth = randomInt(3, this.width - 2);
            const roomHeight = randomInt(3, this.height - 2);
            const roomX = randomInt(1, this.width - roomWidth - 1);
            const roomY = randomInt(1, this.height - roomHeight - 1);
            this.room = { x: this.x + roomX, y: this.y + roomY, width: roomWidth, height: roomHeight };
        }
    }

    createHall(l: Rect | null, r: Rect | null): void {
        if (!l || !r) return;

        this.halls = [];

        const point1 = {
            x: randomInt(rectLeft(l) + 1, rectRight(l) - 2),
            y: randomInt(rectTop(l) + 1, rectBottom(l) - 2),
        };
        const point2 = {
            x: randomInt(rectLeft(r) + 1, rectRight(r) - 2),
            y: randomInt(rectTop(r) + 1, rectBottom(r) - 2),
        };

        const w = point2.x - point1.x;
        const h = point2.y - point1.y;

        if (w < 0) {
            if (h < 0) {
                if (Math.random() < 0.5) {
                    this.halls.push({ x: point2.x, y: point1.y, width: Math.abs(w), height: 1 });
                    this.halls.push({ x: point2.x, y: point2.y, width: 1, height: Math.abs(h) });
                } else {
                    this.halls.push({ x: point2.x, y: point2.y, width: Math.abs(w), height: 1 });
                    this.halls.push({ x: point1.x, y: point2.y, width: 1, height: Math.abs(h) });
                }
            } else if (h > 0) {
                if (Math.random() < 0.5) {
                    this.halls.push({ x: point2.x, y: point1.y, width: Math.abs(w), height: 1 });
                    this.halls.push({ x: point2.x, y: point1.y, width: 1, height: Math.abs(h) });
                } else {
                    this.halls.push({ x: point2.x, y: point2.y, width: Math.abs(w), height: 1 });
                    this.halls.push({ x: point1.x, y: point1.y, width: 1, height: Math.abs(h) });
                }
            } else {
                this.halls.push({ x: point2.x, y: point2.y, width: Math.abs(w), height: 1 });
            }
        } else if (w > 0) {
            if (h < 0) {
                if (Math.random() < 0.5) {
                    this.halls.push({ x: point1.x, y: point2.y, width: Math.abs(w), height: 1 });
                    this.halls.push({ x: point1.x, y: point2.y, width: 1, height: Math.abs(h) });
                } else {
                    this.halls.push({ x: point1.x, y: point1.y, width: Math.abs(w), height: 1 });
                    this.halls.push({ x: point2.x, y: point2.y, width: 1, height: Math.abs(h) });
                }
            } else if (h > 0) {
                if (Math.random() < 0.5) {
                    this.halls.push({ x: point1.x, y: point1.y, width: Math.abs(w), height: 1 });
                    this.halls.push({ x: point2.x, y: point1.y, width: 1, height: Math.abs(h) });
                } else {
                    this.halls.push({ x: point1.x, y: point2.y, width: Math.abs(w), height: 1 });
                    this.halls.push({ x: point1.x, y: point1.y, width: 1, height: Math.abs(h) });
                }
            } else {
                this.halls.push({ x: point1.x, y: point1.y, width: Math.abs(w), height: 1 });
            }
        } else {
            if (h < 0) {
                this.halls.push({ x: point2.x, y: point2.y, width: 1, height: Math.abs(h) });
            } else if (h > 0) {
                this.halls.push({ x: point1.x, y: point1.y, width: 1, height: Math.abs(h) });
            }
        }
    }
}
