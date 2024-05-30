//% blockNamespace="manege"
class Entity {

    id: number
    //% blockCombine block="couleur"
    color: number
    //% blockCombine block="accélération"
    acceleration: number
    //% blockCombine block="vitesse"
    speed: number
    //% blockCombine block="position"
    position: number
    //% blockCombine block="taille"
    width: number
    //% blockCombine block="opacité"
    opacity: number
    //% blockCombine block="couche"
    zindex: number
    //% blockCombine block="caché"
    hidden: boolean

    constructor(id: number, color: number = 0, position: number = 0) {
        this.id = id;
        this.color = color;
        this.position = position;
        this.speed = 0;
        this.acceleration = 0;
        this.width = 1;
        this.opacity = 1;
        this.zindex = 0;
        this.hidden = false;
    }

    collidesWith(other: Entity): boolean {
        if (this.hidden || other.hidden) {
            return false;
        }
        if (this.position < other.position) {
            return this.position + 0.5 * this.width >= other.position - 0.5 * other.width;
        } else {
            return this.position - 0.5 * this.width <= other.position + 0.5 * other.width;
        }
    }

    updateMotion(seconds: number) {
        this.speed += this.acceleration * seconds;
        this.position += this.speed * seconds;
    }

}


namespace manege {

    enum BoundsMode { Clip, Wrap };

    class CollisionSet {

        size: number;
        factor: number;
        map: number[][][];

        constructor(size: number = 32, factor: number = 13) {
            this.size = size;
            this.factor = factor;
            this.map = [];
            for (let i = 0; i < this.size; i++) {
                this.map.push([]);
            }
        }

        _hash(entityA: Entity, entityB: Entity): number {
            if (entityA.id > entityB.id) {
                return this._hash(entityB, entityA);
            }
            return (entityA.id * this.factor + entityB.id) % this.size;
        }

        add(entityA: Entity, entityB: Entity, timestamp: number) {
            if (entityA.id > entityB.id) {
                this.add(entityB, entityA, timestamp);
                return;
            }
            let k = this._hash(entityA, entityB);
            if (this._getIndex(k, entityA.id, entityB.id) < 0) {
                this.map[k].push([entityA.id, entityB.id, timestamp]);
            }
        }

        _getIndex(k: number, idA: number, idB: number): number {
            for (let i = 0; i < this.map[k].length; i++) {
                if (this.map[k][i][0] == idA && this.map[k][i][1] == idB) {
                    return i;
                }
            }
            return -1;
        }

        remove(entityA: Entity, entityB: Entity) {
            if (entityA.id > entityB.id) {
                this.remove(entityB, entityA);
                return;
            }
            let k = this._hash(entityA, entityB);
            let i = this._getIndex(k, entityA.id, entityB.id);
            if (i >= 0) {
                this.map[k].splice(i, 1);
            }
        }

        has(entityA: Entity, entityB: Entity): boolean {
            if (entityA.id > entityB.id) {
                return this.has(entityB, entityA);
            }
            let k = this._hash(entityA, entityB);
            return this._getIndex(k, entityA.id, entityB.id) >= 0;
        }

        get(entityA: Entity, entityB: Entity): number {
            if (entityA.id > entityB.id) {
                return this.get(entityB, entityA);
            }
            let k = this._hash(entityA, entityB);
            let i = this._getIndex(k, entityA.id, entityB.id);
            if (i >= 0) {
                return this.map[k][i][2];
            }
            return -1;
        }

        set(entityA: Entity, entityB: Entity, timestamp: number) {
            if (entityA.id > entityB.id) {
                this.set(entityB, entityA, timestamp);
            }
            let k = this._hash(entityA, entityB);
            let i = this._getIndex(k, entityA.id, entityB.id);
            if (i >= 0) {
                this.map[k][i][2] = timestamp;
            }
        }

    }

    type CollisionListener = {
        a: Entity,
        b: Entity,
        handler: () => void,
        duration: number,
    }

    export enum AnimationType {
        //% block="gigoter"
        Wiggle,
        //% block="grossir"
        Grow,
        //% block="clignoter"
        Blink
    }

    type Animation = {
        entity: Entity,
        animationType: AnimationType,
        timeStart: number,
        duration: number,
        amplitude: number,
        startPosition: number,
        startWidth: number,
        startOpacity: number
    }

    let size: number = 30
    let running: boolean = true
    let ingameTime: number = 0
    let pauseTime: number = 0
    let resumeTime: number = 0
    let updateTime: number = 0
    let deltaTimeSeconds: number = 0
    let entities: Entity[] = []
    let entityCounter: number = 0
    let boundsMode: number = BoundsMode.Wrap
    let collisionSet: CollisionSet = new CollisionSet()
    let onCollisionStart: (a: Entity, b: Entity) => void = (a: Entity, b: Entity) => { }
    let onCollisionEnd: (a: Entity, b: Entity) => void = (a: Entity, b: Entity) => { }
    let onLongCollision: (a: Entity, b: Entity) => void = (a: Entity, b: Entity) => { }
    let animations: Animation[] = []
    let longCollisionDuration = 1000;

    //% block="ajouter une entité de couleur $color à la position $position"
    //% blockSetVariable=joueur
    //% color.shadow=colorNumberPicker
    export function createEntity(color: number = 0, position: number = 0): Entity {
        let entity = new Entity(entityCounter, color, position);
        entities.push(entity);
        entityCounter++;
        return entity;
    }

    function getEntityIndex(entityId: number): number {
        for (let i = 0; i < entities.length; i++) {
            if (entities[i].id == entityId) {
                return i;
            }
        }
        return -1;
    }

    //% block="supprimer l'entité $entity"
    //% entity.shadow=variables_get
    export function removeEntity(entity: Entity): void {
        let i = getEntityIndex(entity.id);
        if (i >= 0) {
            entities.splice(i, 1);
        }
    }

    //% block="démarrer le jeu"
    export function startGame() {
        ingameTime = 0;
        let currentTime = input.runningTime();
        pauseTime = currentTime;
        resumeTime = currentTime;
        updateTime = currentTime;
        running = true;
        for (const a of entities) {
            for (const b of entities) {
                if (a.id >= b.id) continue;
                collisionSet.remove(a, b);
            }
        }
    }

    //% block="mettre le jeu en pause"
    export function pauseGame() {
        let currentTime = input.runningTime();
        pauseTime = currentTime;
        running = false;
    }

    //% block="reprendre le jeu"
    export function resume() {
        let currentTime = input.runningTime();
        resumeTime = currentTime;
        updateTime = currentTime;
        running = true;
    }

    //% block="mettre à jour l'horloge"
    export function updateTimes() {
        let currentTime = input.runningTime();
        let dt = 0;
        if (running) {
            dt = currentTime - updateTime;
        }
        ingameTime += dt;
        deltaTimeSeconds = dt / 1000;
        updateTime = currentTime;
    }

    function updateAnimations() {
        let i = 0;
        while (i < animations.length) {
            const animation = animations[i];
            const progress = Math.min(1, (ingameTime - animation.timeStart) / animation.duration);
            if (progress < 0) {
                i++;
                continue;
            }
            switch (animation.animationType) {
                case AnimationType.Wiggle:
                    animation.entity.position = animation.startPosition + animation.amplitude * Math.sin(4 * Math.PI * progress);
                    break;
                case AnimationType.Grow:
                    animation.entity.width = animation.startWidth + animation.amplitude * (1 - Math.cos(4 * Math.PI * progress)) / 2;
                    break;
                case AnimationType.Blink:
                    animation.entity.opacity = animation.startOpacity * (Math.cos(4 * Math.PI * progress) + 1) / 2;
                    break;
            }
            if (progress >= 1) {
                animation.entity.position = animation.startPosition;
                animation.entity.width = animation.startWidth;
                animation.entity.opacity = animation.startOpacity;
                animations.splice(i, 1);
            } else {
                i++;
            }
        }
    }

    function updateCollisions() {
        for (const a of entities) {
            for (const b of entities) {
                if (a.id >= b.id) continue;
                let wasColliding = collisionSet.has(a, b);
                let isColliding = a.collidesWith(b);
                if (!wasColliding && !isColliding) {
                    //pass
                } else if (!wasColliding && isColliding) {
                    collisionSet.add(a, b, ingameTime);
                    control.inBackground(() => {
                        onCollisionStart(a, b);
                    });
                } else if (wasColliding && !isColliding) {
                    collisionSet.remove(a, b);
                    control.inBackground(() => {
                        onCollisionEnd(a, b);
                    });
                } else if (wasColliding && isColliding) {
                    let collisionTime = collisionSet.get(a, b);
                    if (collisionTime >= 0 && (ingameTime - collisionTime >= longCollisionDuration)) {
                        collisionSet.set(a, b, -2);
                        control.inBackground(() => {
                            onLongCollision(a, b);
                        });
                    }
                }
            }
        }
    }

    //% block="mettre à jour les entités (animations, collisions)"
    export function updateEntities() {
        updateAnimations();
        for (const entity of entities) {
            entity.updateMotion(deltaTimeSeconds);
            entity.opacity = Math.max(0, Math.min(1, entity.opacity));
            switch (boundsMode) {
                case BoundsMode.Clip:
                    entity.position = Math.max(0, Math.min(size - 1, entity.position));
                    break;
                case BoundsMode.Wrap:
                    if (entity.position < 0) {
                        entity.position += size * Math.ceil(-entity.position / size);
                    } else if (entity.position >= size) {
                        entity.position -= size * Math.floor(entity.position / size);
                    }
                    break;
            }
        }
        updateCollisions();
    }

    function alphaCompose(backgroundColor: number, foregroundColor: number, alpha: number): number {
        let bgRed = (backgroundColor >> 16) & 0xFF;
        let bgGreen = (backgroundColor >> 8) & 0xFF;
        let bgBlue = backgroundColor & 0xFF;
        let fgRed = (foregroundColor >> 16) & 0xFF;
        let fgGreen = (foregroundColor >> 8) & 0xFF;
        let fgBlue = foregroundColor & 0xFF;
        return neopixel.rgb(
            (1 - alpha) * bgRed + alpha * fgRed,
            (1 - alpha) * bgGreen + alpha * fgGreen,
            (1 - alpha) * bgBlue + alpha * fgBlue
        );
    }

    function getColors(): number[] {
        entities.sort((a, b) => a.zindex - b.zindex);
        let rgbs = [];
        let alphas = [];
        for (let i = 0; i < size; i++) {
            rgbs.push(0x000000);
            alphas.push(1);
        }
        for (const entity of entities) {

            if (entity.hidden) {
                continue;
            }

            // Adding 0.5 to be at the center of the cell
            let x = entity.position + 0.5;

            let start = Math.floor(x - 0.5 * entity.width);
            let end = Math.floor(x + 0.5 * entity.width);

            for (let i = start; i <= end; i++) {
                if (boundsMode == BoundsMode.Clip && (i < 0 || i >= size)) {
                    continue;
                }
                let j = i;
                if (i < 0) {
                    j = i + size;
                } else if (i >= size) {
                    j = i - size;
                }
                let alpha = entity.opacity;
                if (i == start) {
                    alpha *= 1 - (x - 0.5 * entity.width - start);
                } else if (i == end) {
                    alpha *= x + 0.5 * entity.width - end;
                }
                if (alpha == 1) {
                    rgbs[j] = entity.color;
                } else {
                    rgbs[j] = alphaCompose(rgbs[j], entity.color, alpha);
                }
            }
            
        }
        return rgbs;
    }

    //% block="peindre les entités sur $strip"
    //% strip.shadow=variables_get
    export function drawEntities(strip: neopixel.Strip) {
        let colors = getColors();
        for (let i = 0; i < size; i++) {
            strip.setPixelColor(i, colors[i]);
        }
        strip.show();
    }

    //% block="lorsqu'une collision se produit entre $a et $b"
    //% draggableParameters="reporter"
    export function setOnCollisionStart(handler: (a: Entity, b: Entity) => void) {
        onCollisionStart = handler;
    }

    //% block="lorsqu'une collision se termine entre $a et $b"
    //% draggableParameters="reporter"
    export function setOnCollisionEnd(handler: (a: Entity, b: Entity) => void) {
        onCollisionEnd = handler;
    }

    //% block="lorsque $a et $b se touchent depuis longtemps"
    //% draggableParameters="reporter"
    export function setOnLongCollision(handler: (a: Entity, b: Entity) => void) {
        onLongCollision = handler;
    }

    //% block="les entités $a1 et $a2 sont $b1 et $b2"
    //% a1.defl=a
    //% a1.shadow=variables_get
    //% a2.defl=b
    //% a2.shadow=variables_get
    //% b1.shadow=variables_get
    //% b2.shadow=variables_get
    //% inlineInputMode=inline
    export function sameEntities(a1: Entity, a2: Entity, b1: Entity, b2: Entity): boolean {
        return (a1.id == b1.id && a2.id == b2.id) || (a1.id == b2.id && a2.id == b1.id);
    }

    //% block="faire $animationType l'entité $entity pendant (ms) $duration || d'amplitude $amplitude et après un délais de (ms) $delay"
    //% expandableArgumentMode="toggle"
    //% entity.shadow=variables_get
    //% animationType.defl=AnimationType.Wiggle
    //% amplitude.defl=1
    //% duration.defl=1000
    //% duration.shadow=timePicker
    //% inlineInputMode=inline
    export function animateEntity(entity: Entity, animationType: AnimationType = AnimationType.Grow, duration: number = 1000, amplitude: number = 1, delay: number = 0) {
        animations.push({
            entity: entity,
            animationType: animationType,
            timeStart: ingameTime + delay,
            duration: duration,
            amplitude: amplitude,
            startPosition: entity.position,
            startWidth: entity.width,
            startOpacity: entity.opacity,
        });
    }

    //% block="régler la taille du jeu à $newSize"
    //% newSize.defl=30
    //% advanced=true
    export function setSize(newSize: number = 30) {
        size = newSize;
    }

    //% block="régler la durée d'une collision longue à (ms) $duration"
    //% duration.defl=1000
    //% duration.shadow=timePicker
    //% advanced=true
    export function setLongCollisionDuration(duration: number = 1000) {
        longCollisionDuration = duration;
    }

    //% block="secondes écoulées depuis le début du jeu"
    //% advanced=true
    export function getIngameTime() : number {
        return ingameTime / 1000;
    }

    //% block="secondes écoulées depuis la dernière mise à jour"
    //% advanced=true
    export function getDeltaTime() : number {
        return deltaTimeSeconds;
    }

    function noise(phase: number = 0, min: number = -1, max: number = 1, freq: number = 1): number {
        let x = freq * ingameTime / 1000 + phase;
        let y = (Math.sin(0.2 * x) + Math.sin(0.314159 * x));
        return (y + 2) / 4 * (max - min) + min;
    }

    //% block="bruit A entre $min et $max || de fréquence $freq"
    //% advanced=true
    export function noiseA(min: number = -1, max: number = 1, freq: number = 1): number {
        return noise(0, min, max, freq);
    }

    //% block="bruit B entre $min et $max || de fréquence $freq"
    //% advanced=true
    export function noiseB(min: number = -1, max: number = 1, freq: number = 1): number {
        return noise(3600, min, max, freq);
    }

    //% block="bruit C entre $min et $max || de fréquence $freq"
    //% advanced=true
    export function noiseC(min: number = -1, max: number = 1, freq: number = 1): number {
        return noise(7200, min, max, freq);
    }

    //% block="choisir une position libre au hasard || de taille $spotSize"
    //% spotSize.defl=1
    //% advanced=true
    export function getRandomFreePosition(spotSize: number = 1): number {
        const margin = spotSize / 2;
        const intervals: number[][] = [[0, size]];
        for (const entity of entities) {
            const start = entity.position - entity.width / 2 - margin;
            const end = entity.position + entity.width / 2 + margin;
            let parts: number[][] = [];
            if (start < 0) {
                parts = [[0, end], [start + size, size]];
            } else if (end > size) {
                parts = [[0, end - size], [start, size]];
            } else {
                parts = [[start, end]];
            }
            for (const part of parts) {
                let i = 0;
                while (i < intervals.length) {
                    const interval = intervals[i];
                    if (part[0] <= interval[0] && part[1] >= interval[0] && part[1] <= interval[1]) {
                        intervals[i][0] = part[1];
                    } else if (part[0] >= interval[0] && part[1] <= interval[1]) {
                        intervals.insertAt(i, [interval[0], interval[1]]);
                        intervals[i][1] = part[0];
                        i++;
                        intervals[i][0] = part[1];
                    } else if (part[0] >= interval[0] && part[0] <= interval[1] && part[1] >= interval[1]) {
                        intervals[i][1] = part[0];
                    } else {
                        //pass
                    }
                    i++;
                }
            }
        }
        const widths = [];
        let totalWidth = 0;
        let j = 0;
        while (j < intervals.length) {
            let width = intervals[j][1] - intervals[j][0];
            if (width > 0) {
                widths.push(width);
                totalWidth += width;
                j++;
            } else {
                intervals.splice(j, 1);
            }
        }
        if (totalWidth == 0) {
            return 0;
        }
        let randomNumber = Math.random() * totalWidth;
        let upperBound = 0;
        for (let k = 0; k < intervals.length; k++) {
            if (randomNumber <= upperBound + widths[k]) {
                const x = (randomNumber - upperBound) / widths[k];
                return (1 - x) * intervals[k][0] + x * intervals[k][1];
                break;
            }
            upperBound += widths[k];
        }
        return 0;
    }

}