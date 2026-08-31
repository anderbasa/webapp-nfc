// Un "muelle" físico simple, sin librerías externas.
// Se usa para que arrastrar y soltar fotos se sienta natural: continuo,
// interrumpible en cualquier momento, y que conserve la velocidad del gesto.
//
// dampingRatio: 1.0 = sin rebote (se posa suave). <1.0 = rebota un poco.
// response: en segundos, cuánto tarda en llegar al valor objetivo.

class Spring {
  constructor({ value = 0, dampingRatio = 1, response = 0.35 } = {}) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.dampingRatio = dampingRatio;
    this.response = response;
  }

  // Cambia el objetivo sin cortar la velocidad actual — así se puede
  // "agarrar" una animación a medias y redirigirla sin que dé un salto.
  retarget(target) {
    this.target = target;
  }

  // Coloca el valor de golpe (para cuando el dedo agarra la foto: no hay
  // animación, el valor tiene que seguir al dedo al instante).
  set(value) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  step(dt) {
    const omega = (2 * Math.PI) / Math.max(this.response, 0.01);
    const force =
      -omega * omega * (this.value - this.target) -
      2 * this.dampingRatio * omega * this.velocity;
    this.velocity += force * dt;
    this.value += this.velocity * dt;
    return this.value;
  }

  atRest(epsilon = 0.01) {
    return (
      Math.abs(this.value - this.target) < epsilon &&
      Math.abs(this.velocity) < epsilon
    );
  }
}

// Ejecuta uno o varios muelles a la vez con requestAnimationFrame,
// llamando a onUpdate en cada fotograma hasta que todos se han posado.
function runSprings(springs, onUpdate, onSettle) {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30); // evita saltos si la pestaña estuvo en pausa
    last = now;
    let allSettled = true;
    springs.forEach((s) => {
      s.step(dt);
      if (!s.atRest()) allSettled = false;
    });
    onUpdate();
    if (allSettled) {
      springs.forEach((s) => (s.value = s.target));
      onUpdate();
      if (onSettle) onSettle();
    } else {
      requestAnimationFrame(frame);
    }
  }
  requestAnimationFrame(frame);
}
