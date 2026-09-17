import { Math as PhaserMath } from 'phaser';

type Vector2 = PhaserMath.Vector2;
const Vector2 = PhaserMath.Vector2;

class EndPoint extends Vector2 {
    begin = false;
    // Not `angle` - Vector2 already has an `angle()` method.
    theta = 0;
    // Assigned immediately after construction, once the owning Segment
    // exists - see addSegment(). The two are circular by nature: a segment
    // needs its endpoints to exist first, and each endpoint needs to know
    // its segment.
    segment!: Segment;
}

class Segment {
    constructor(public p1: EndPoint, public p2: EndPoint) {}
}

export class Visibility {
    private segments: Segment[] = [];
    private endpoints: EndPoint[] = [];
    private center = new Vector2(0, 0);
    private open: Segment[] = [];
    output: Vector2[] = [];

    loadMap(size: number): void {
        this.segments.length = 0;
        this.endpoints.length = 0;
        this.addSegment(0, 0, 0, size);
        this.addSegment(0, size, size, size);
        this.addSegment(size, size, size, 0);
        this.addSegment(size, 0, 0, 0);
    }

    addSegment(x1: number, y1: number, x2: number, y2: number): void {
        const p1 = new EndPoint(x1, y1);
        const p2 = new EndPoint(x2, y2);
        const segment = new Segment(p1, p2);
        p1.segment = segment;
        p2.segment = segment;

        this.segments.push(segment);
        this.endpoints.push(p1, p2);
    }

    setLightLocation(x: number, y: number): void {
        this.center.set(x, y);

        for (const segment of this.segments) {
            segment.p1.theta = Math.atan2(segment.p1.y - y, segment.p1.x - x);
            segment.p2.theta = Math.atan2(segment.p2.y - y, segment.p2.x - x);

            let dAngle = segment.p2.theta - segment.p1.theta;
            if (dAngle <= -Math.PI) dAngle += 2 * Math.PI;
            if (dAngle > Math.PI) dAngle -= 2 * Math.PI;
            segment.p1.begin = dAngle > 0;
            segment.p2.begin = !segment.p1.begin;
        }
    }

    sweep(): void {
        this.output = [];
        this.endpoints.sort(Visibility.endpointCompare);

        this.open.length = 0;
        let beginAngle = 0;

        for (let pass = 0; pass < 2; pass++) {
            for (const p of this.endpoints) {
                const currentOld = this.open[0] as Segment | undefined;

                if (p.begin) {
                    let index = 0;
                    while (index < this.open.length && Visibility.segmentInFrontOf(p.segment, this.open[index], this.center)) {
                        index++;
                    }
                    this.open.splice(index, 0, p.segment);
                } else {
                    const index = this.open.indexOf(p.segment);
                    if (index !== -1) {
                        this.open.splice(index, 1);
                    }
                }

                const currentNew = this.open[0] as Segment | undefined;
                if (currentOld !== currentNew) {
                    if (pass === 1) {
                        this.addTriangle(beginAngle, p.theta, currentOld);
                    }
                    beginAngle = p.theta;
                }
            }
        }
    }

    private static endpointCompare(a: EndPoint, b: EndPoint): number {
        if (a.theta !== b.theta) return a.theta - b.theta;
        // Ties (common, at shared corners) go begin-before-end.
        return (b.begin ? 1 : 0) - (a.begin ? 1 : 0);
    }

    private static leftOf(s: Segment, p: Vector2): boolean {
        const cross = (s.p2.x - s.p1.x) * (p.y - s.p1.y) - (s.p2.y - s.p1.y) * (p.x - s.p1.x);
        return cross < 0;
    }

    private static interpolate(p: Vector2, q: Vector2, f: number): Vector2 {
        return new Vector2(p.x * (1 - f) + q.x * f, p.y * (1 - f) + q.y * f);
    }

    private static segmentInFrontOf(a: Segment, b: Segment, relativeTo: Vector2): boolean {
        // Segments are shortened by 1% before testing so that intersections
        // at shared endpoints (common - adjacent wall segments meet exactly)
        // don't register as crossings.
        const A1 = Visibility.leftOf(a, Visibility.interpolate(b.p1, b.p2, 0.01));
        const A2 = Visibility.leftOf(a, Visibility.interpolate(b.p2, b.p1, 0.01));
        const A3 = Visibility.leftOf(a, relativeTo);
        const B1 = Visibility.leftOf(b, Visibility.interpolate(a.p1, a.p2, 0.01));
        const B2 = Visibility.leftOf(b, Visibility.interpolate(a.p2, a.p1, 0.01));
        const B3 = Visibility.leftOf(b, relativeTo);

        if (B1 === B2 && B2 !== B3) return true;
        if (A1 === A2 && A2 === A3) return true;
        if (A1 === A2 && A2 !== A3) return false;
        if (B1 === B2 && B2 === B3) return false;

        // The segments actually cross, or are ambiguously collinear - not
        // handled robustly. See the limitation noted above.
        return false;
    }

    private static lineIntersection(p1: Vector2, p2: Vector2, p3: Vector2, p4: Vector2): Vector2 {
        const s = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x))
            / ((p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y));
        return new Vector2(p1.x + s * (p2.x - p1.x), p1.y + s * (p2.y - p1.y));
    }

    private addTriangle(angle1: number, angle2: number, segment: Segment | undefined): void {
        const start = new Vector2(this.center.x + Math.cos(angle1), this.center.y + Math.sin(angle1));
        const end = new Vector2(this.center.x + Math.cos(angle2), this.center.y + Math.sin(angle2));

        // The far edge to intersect against: the blocking segment, or (if
        // sight runs out into the open) a point far along each ray.
        const far1 = segment ? segment.p1 : new Vector2(this.center.x + Math.cos(angle1) * 500, this.center.y + Math.sin(angle1) * 500);
        const far2 = segment ? segment.p2 : new Vector2(this.center.x + Math.cos(angle2) * 500, this.center.y + Math.sin(angle2) * 500);

        this.output.push(
            Visibility.lineIntersection(far1, far2, this.center, start),
            Visibility.lineIntersection(far1, far2, this.center, end),
        );
    }
}
