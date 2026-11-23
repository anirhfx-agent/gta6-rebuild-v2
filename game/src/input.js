// Keyboard + mouse input. One shared object the game loop reads each frame;
// keys are tracked by e.code so layouts do not matter.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedKeys = new Set(); // edge-triggered presses, cleared each frame
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      // Record the press even if the key is released before the next frame,
      // so a quick tap is never missed (auto-repeat does not re-trigger).
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => this.keys.clear();
    this._onMouseMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    };
    this._onMouseDown = (e) => {
      this._onMouseMove(e);
      this.mouse.down = true;
      this.mouse.clicked = true;
    };
    this._onMouseUp = () => { this.mouse.down = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // Edge-triggered: true once per physical press, even for a tap that is
  // released before the next animation frame.
  pressed(code) {
    return this.pressedKeys.has(code);
  }

  // Call at the end of each frame so pressed() works next frame.
  endFrame() {
    this.pressedKeys.clear();
    this.mouse.clicked = false;
  }

  // Mouse position in world coordinates, given the camera.
  worldMouse(cam, canvas) {
    const scale = canvas.width / 1280; // game is authored at 1280x720
    return {
      x: cam.x - canvas.width / 2 / scale + this.mouse.x / scale,
      y: cam.y - canvas.height / 2 / scale + this.mouse.y / scale,
    };
  }
}
