type PushFn = () => void

let push: PushFn = () => {}

export function registerSchedulePush(fn: PushFn): void {
  push = fn
}

export function schedulePush(): void {
  push()
}
