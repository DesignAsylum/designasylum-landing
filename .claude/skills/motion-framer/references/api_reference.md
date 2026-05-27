# Motion & Framer Motion — Complete API Reference

## Motion Component Props

All motion components (`motion.div`, `motion.button`, etc.) accept these props:

```typescript
interface MotionProps {
  animate?: AnimationControls | TargetAndTransition | VariantLabels
  initial?: boolean | Target | VariantLabels
  exit?: TargetAndTransition | VariantLabels
  transition?: Transition
  variants?: Variants
  style?: MotionStyle
  layout?: boolean | "position" | "size"
  layoutId?: string
  layoutDependency?: any
  layoutScroll?: boolean
  whileHover?: VariantLabels | TargetAndTransition
  whileTap?: VariantLabels | TargetAndTransition
  whileFocus?: VariantLabels | TargetAndTransition
  whileDrag?: VariantLabels | TargetAndTransition
  whileInView?: VariantLabels | TargetAndTransition
  drag?: boolean | "x" | "y"
  dragConstraints?: Constraints | RefObject<Element>
  dragElastic?: DragElastic
  dragMomentum?: boolean
  dragTransition?: InertiaOptions
  dragPropagation?: boolean
  dragSnapToOrigin?: boolean
  viewport?: ViewportOptions
  onUpdate?: (latest: Target) => void
  onAnimationStart?: (definition: AnimationDefinition) => void
  onAnimationComplete?: (definition: AnimationDefinition) => void
  onHoverStart?: (event: MouseEvent, info: EventInfo) => void
  onHoverEnd?: (event: MouseEvent, info: EventInfo) => void
  onTap?: (event: MouseEvent | TouchEvent | PointerEvent, info: TapInfo) => void
  onTapStart?: (event: MouseEvent | TouchEvent | PointerEvent, info: TapInfo) => void
  onTapCancel?: (event: MouseEvent | TouchEvent | PointerEvent, info: TapInfo) => void
  onDragStart?: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void
  onDrag?: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void
  onDragEnd?: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void
  onViewportEnter?: (entry: IntersectionObserverEntry | null) => void
  onViewportLeave?: (entry: IntersectionObserverEntry | null) => void
}
```

---

## Transition Interface

```typescript
interface Transition {
  duration?: number
  ease?: Easing | Easing[]
  times?: number[]
  type?: "tween" | "spring" | "inertia"
  stiffness?: number
  damping?: number
  mass?: number
  velocity?: number
  restSpeed?: number
  restDelta?: number
  visualDuration?: number
  bounce?: number
  delay?: number
  delayChildren?: number
  staggerChildren?: number
  staggerDirection?: 1 | -1
  when?: "beforeChildren" | "afterChildren" | false
  repeat?: number
  repeatType?: "loop" | "reverse" | "mirror"
  repeatDelay?: number
}
```

**Easing options:** `"linear"`, `"easeIn"`, `"easeOut"`, `"easeInOut"`, `"circIn"`, `"circOut"`, `"circInOut"`, `"backIn"`, `"backOut"`, `"backInOut"`, `"anticipate"`, or custom cubic-bezier `[0.42, 0, 0.58, 1]`

---

## Style Transform Properties

```typescript
// Individual transform properties supported by Motion style prop
x, y, z          // Translation (px)
scale, scaleX, scaleY  // Scale (unitless)
rotate, rotateX, rotateY, rotateZ  // Rotation (deg)
skew, skewX, skewY     // Skew (deg)
originX, originY, originZ  // Transform origin (0-1 or px)
perspective        // 3D perspective (px)
```

---

## Hooks Reference

### useAnimate

```typescript
const [scope, animate] = useAnimate()

// Animate single element
animate(scope.current, { x: 100 })

// Animate with selector
animate("li", { opacity: 1 })

// Sequence
animate([
  [scope.current, { opacity: 1 }],
  ["li", { x: 0 }, { delay: stagger(0.1) }],
  [".button", { scale: 1.2 }]
])

// Controls
const controls = animate(element, { x: 100 })
controls.play()
controls.pause()
controls.stop()
controls.cancel()
controls.speed = 0.5
controls.time = 0
```

### useMotionValue

```typescript
const x = useMotionValue(0)
x.get()           // Read current value
x.set(100)        // Set value
x.on("change", (latest) => {})
x.on("animationStart", () => {})
x.on("animationComplete", () => {})
```

### useTransform

```typescript
const x = useMotionValue(0)
const opacity = useTransform(x, [0, 100], [1, 0])
const color = useTransform(x, [0, 100], ["#ff0000", "#0000ff"])
```

### useSpring

```typescript
const x = useMotionValue(0)
const springX = useSpring(x, { stiffness: 300, damping: 20 })

// Options
interface SpringOptions {
  stiffness?: number
  damping?: number
  mass?: number
  velocity?: number
  restSpeed?: number
  restDelta?: number
}
```

### useScroll

```typescript
const { scrollX, scrollY, scrollXProgress, scrollYProgress } = useScroll()

// With element ref
const { scrollYProgress } = useScroll({
  target: ref,
  offset: ["start end", "end start"]
})
```

### useInView

```typescript
const isInView = useInView(ref, {
  once: true,
  amount: 0.5,      // "some" | "all" | 0-1
  margin: "-100px",
  root: containerRef
})
```

### useReducedMotion

```typescript
const shouldReduceMotion = useReducedMotion()
```

### useAnimationControls

```typescript
const controls = useAnimationControls()
controls.start({ x: 100 })
controls.stop()
controls.set({ x: 0 })

<motion.div animate={controls} />
```

### usePresence

```typescript
const [isPresent, safeToRemove] = usePresence()

useEffect(() => {
  if (!isPresent) {
    animate(ref.current, { opacity: 0 }).then(safeToRemove)
  }
}, [isPresent])
```

---

## AnimatePresence Props

```typescript
interface AnimatePresenceProps {
  initial?: boolean
  custom?: any
  mode?: "wait" | "sync" | "popLayout"
  onExitComplete?: () => void
  propagate?: boolean
}
```

**Mode options:**
- `"sync"` (default) - Exit and enter simultaneously
- `"wait"` - Wait for exit before enter starts
- `"popLayout"` - Exit components render in separate layer

---

## Utilities

### stagger

```typescript
import { stagger } from "framer-motion"

animate("li", { opacity: 1 }, { delay: stagger(0.1) })

stagger(0.1, {
  startDelay: 0.2,
  from: "first" | "last" | "center" | number,
  ease: "easeInOut"
})
```

### animate (standalone)

```typescript
import { animate } from "framer-motion"

animate(element, { x: 100 }, { duration: 0.5 })
animate(".box", { opacity: 1 })
```

### transform / mix / clamp

```typescript
import { transform, mix, clamp } from "framer-motion"

transform(input, [0, 100], [0, 1])
mix(0, 100, 0.5)       // 50
clamp(0, 100, 150)     // 100
```

---

## Event Info Types

```typescript
interface PanInfo {
  point: { x: number; y: number }
  delta: { x: number; y: number }
  offset: { x: number; y: number }
  velocity: { x: number; y: number }
}

interface TapInfo {
  point: { x: number; y: number }
}
```

---

## TypeScript Imports

```typescript
import type {
  TargetAndTransition,
  Transition,
  Variants,
  MotionProps,
  AnimationControls,
  PanInfo,
  TapInfo
} from "framer-motion"

// Custom component with motion props
import { motion, HTMLMotionProps } from "framer-motion"

interface Props extends HTMLMotionProps<"div"> {
  customProp: string
}
```

---

## Quick Reference

```typescript
// Hover effect
<motion.div whileHover={{ scale: 1.1 }} />

// Tap feedback
<motion.button whileTap={{ scale: 0.95 }} />

// Drag
<motion.div drag dragConstraints={{ left: 0, right: 300 }} />

// Fade in on mount
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />

// Exit animation
<AnimatePresence>
  {show && <motion.div exit={{ opacity: 0 }} />}
</AnimatePresence>

// Layout animation
<motion.div layout />

// Shared layout animation
<motion.div layoutId="shared-element" />

// Scroll-triggered
<motion.div whileInView={{ opacity: 1 }} viewport={{ once: true }} />

// Stagger children
<motion.div variants={container}>
  <motion.div variants={item} />
  <motion.div variants={item} />
</motion.div>

// Spring animation
<motion.div
  animate={{ x: 100 }}
  transition={{ type: "spring", stiffness: 300 }}
/>

// Repeating animation
<motion.div
  animate={{ rotate: 360 }}
  transition={{ repeat: Infinity, duration: 2 }}
/>
```
