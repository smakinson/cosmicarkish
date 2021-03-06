import {PlanetGuns, SAUCER_HIT_EVENT} from "./PlanetGuns";
import {Saucer, SAUCER_DOCKED_EVENT} from "./Saucer";
import Rectangle = createjs.Rectangle;
import {CANVAS_HEIGHT, CANVAS_WIDTH, Sides} from "./Game";
import {Ship, SHIP_DESTROYED_EVENT} from "./Ship";
import {State} from "../State";
import {Beast} from "./Beast";
import {BeastEvent} from "../events/BeastEvent";

const GROUND_HEIGHT: number = 40;

export const WARN_COMPLETE_EVENT: string = 'Planet.WARN_COMPLETE_EVENT';
export const ALL_BEASTS_CAPTURED_EVENT: string = 'Planet.ALL_BEASTS_CAPTURED_EVENT';

export class Planet extends lib.Planet {

    private _destroyed: boolean = false;
    get destroyed(): boolean {
        return this._destroyed;
    }

    private _warningGiven: boolean = false;
    get warningGiven(): boolean {
        return this._warningGiven;
    }

    private guns: PlanetGuns;
    private _saucer: Saucer;

    get saucerDocked(): Boolean {
        if (this._saucer)
            return this._saucer.docked;

        return false;
    }

    get isClear(): boolean {
        return this.beastLeftCaptured && this.beastRightCaptured;
    }

    private saucerArea: Rectangle;
    private ship: Ship;
    private beastLeft: Beast;
    private beastLeftCaptured: boolean;
    private beastRight: Beast;
    private beastRightCaptured: boolean;

    private saucerDockedListener: Function;
    private saucerHitListener: Function;
    private shipDestroyedListener: Function;
    private beastCapturedListener: Function;

    private warnTween: TweenMax = new TweenMax(this, 0, {});

    private state: State = State.getInstance();

    // on the stage:
    private ground: MovieClip;

    constructor() {
        super();
    }

    destroy(): void {
        this._destroyed = true;

        this.reset();

        // TODO: Stop sounds?

        if (this.parent) {
            this.parent.removeChild(this);
        }
    }

    private destroySaucer(): void {
        if (this._saucer) {
            this._saucer.off(SAUCER_DOCKED_EVENT, this.saucerDockedListener);
            this._saucer.off(BeastEvent.CAPTURED, this.beastCapturedListener);

            this._saucer.destroy();
            if (this.contains(this._saucer)) {
                this.removeChild(this._saucer);
            }
        }
        this._saucer = null;
    }

    private destroyGuns(): void {
        if (this.guns) {
            this.guns.off(SAUCER_HIT_EVENT, this.saucerHitListener);

            this.guns.destroy();
            if (this.contains(this.guns)) {
                this.removeChild(this.guns);
            }
        }
        this.guns = null;
    }

    private destroyBeasts(): void {
        if (this.beastLeft) {
            this.beastLeft.destroy();
            if (this.contains(this.beastLeft)) {
                this.removeChild(this.beastLeft);
            }
        }
        if (this.beastRight) {
            this.beastRight.destroy();
            if (this.contains(this.beastRight)) {
                this.removeChild(this.beastRight);
            }
        }
    }

    clearSky(): void {
        this.destroySaucer();
    }

    private createSaucer(): void {
        this._saucer = new Saucer(this.ship, this.saucerArea, [this.beastLeft, this.beastRight]);
        this.addChildAt(this._saucer, 0);

        this.saucerDockedListener = this._saucer.on(SAUCER_DOCKED_EVENT, this.handleSaucerDocked, this);
        this.beastCapturedListener = this._saucer.on(BeastEvent.CAPTURED, this.handleBeastCaptured, this);
    }

    private createGuns(): void {
        // No guns on the first level.
        if (this.state.level > 1) {
            this.guns = new PlanetGuns(this._saucer, this.saucerArea);
            this.addChildAt(this.guns, 1);
            this.saucerHitListener = this.guns.on(SAUCER_HIT_EVENT, this.handleSaucerHit, this);
            this.guns.run();
        }
    }

    private createBeasts(): void {

        let leftOtherBeast: Beast;
        let rightOtherBeast: Beast;

        // See if this is a return visit after having captured only one beast.
        if (this.beastLeftCaptured == false) {
            this.beastLeft = new Beast(Sides.Left, this._saucer);
            this.beastLeft.x = 200;
            this.ground.addChild(this.beastLeft);

            rightOtherBeast = this.beastLeft;
        }

        if (this.beastRightCaptured == false) {
            this.beastRight = new Beast(Sides.Right, this._saucer);
            this.beastRight.x = CANVAS_WIDTH - this.beastLeft.x;
            this.ground.addChild(this.beastRight);

            leftOtherBeast = this.beastRight;
        }

        this.beastLeft.run(leftOtherBeast);
        this.beastRight.run(rightOtherBeast);
    }

    getEntryAnimation(): TweenMax {
        // TODO: Move to the timeline?
        return TweenMax.to(this.ground, .3, {
            y: '-=' + GROUND_HEIGHT
        });
    }

    getExitAnimation(): TweenMax {
        // TODO: Move to the timeline?
        return TweenMax.to(this.ground, .3, {
            y: CANVAS_HEIGHT
        });
    }

    private handleSaucerDocked(): void {
        if (this._warningGiven == false) {
            if (this.beastLeftCaptured && this.beastRightCaptured) {
                this.warnTween.kill();

                this.state.planetCleared(this._warningGiven);

                this.dispatchEvent(ALL_BEASTS_CAPTURED_EVENT);
            }
        }
    }

    private handleSaucerHit(): void {

        this._saucer.blowUp();
        this.state.saucerHit();

        // Release a beast if any are captured.
        if (this.beastLeftCaptured) {
            this.beastLeft.releaseFromCapture();
            this.beastLeftCaptured = false;
        } else if (this.beastRightCaptured) {
            this.beastRight.releaseFromCapture();
            this.beastRightCaptured = false;
        }
    }

    private handleShipDestroyed(): void {

        this.warnTween.kill();

        if (this.beastLeftCaptured) {
            this.beastLeft.releaseFromCapture();
            this.beastLeftCaptured = false;
        }

        if (this.beastRightCaptured) {
            this.beastRight.releaseFromCapture();
            this.beastRightCaptured = false;
        }

        this.destroySaucer();
    }

    private handleBeastCaptured(event: BeastEvent): void {
        if (event.beast.side == Sides.Left) {
            this.beastLeftCaptured = true;
        } else if (event.beast.side == Sides.Right) {
            this.beastRightCaptured = true;
        }

        this.state.beastieCaptured();
    }

    nextLevel(): void {
        this.beastLeftCaptured = false;
        this.beastRightCaptured = false;
    }

    pause(): void {
        if (this.guns) this.guns.pause();
        this.beastLeft.pause();
        this.beastRight.pause();
    }

    resume(): void {
        if (this.guns) this.guns.resume();
        this.beastLeft.resume();
        this.beastRight.resume();
    }

    run(ship: Ship): void {

        this.ship = ship;

        let xOffset: number = 42;
        let shipBottomY: number = this.ship.y + this.ship.bottomDistance;

        this.saucerArea = new Rectangle(xOffset, shipBottomY, CANVAS_WIDTH - xOffset * 2, CANVAS_HEIGHT - shipBottomY - GROUND_HEIGHT - 70);

        this.createBeasts();    // Create the beasts first so they can be handed to the saucer.
        this.createSaucer();
        this.createGuns();

        this.shipDestroyedListener = this.ship.on(SHIP_DESTROYED_EVENT, this.handleShipDestroyed, this);

        this.startWarningTimer();
    }

    // For between visits, call nextLevel also as level increases.
    reset(): void {

        this.warnTween.kill();
        this.destroySaucer();
        this.destroyGuns();
        this.destroyBeasts();

        if (this.ship) {
            this.ship.off(SHIP_DESTROYED_EVENT, this.shipDestroyedListener);
        }

        this._warningGiven = false;
    }

    private startWarningTimer(): void {
        this.warnTween.kill();
        this.warnTween = TweenMax.delayedCall(this.state.planetWarningDelay, this.handleWarningTime, [], this);
    }

    private handleWarningTime(): void {

        this._warningGiven = true;

        this.warnTween.kill();
        this.ship.warn();
        this._saucer.warn();

        // TODO: Determine this delay by the level?
        let warningDelay: number = 3;

        this.warnTween = TweenMax.delayedCall(warningDelay, this.handleWarningComplete, [], this);
    }

    private handleWarningComplete(): void {
        this.warnTween.kill();
        this.ship.stopWarn();

        this.dispatchEvent(WARN_COMPLETE_EVENT);
    }

}