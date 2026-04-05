declare module 'react' {
  const React: any
  export default React
  export const Fragment: any
  export const Suspense: any
  export const createContext: any
  export const createElement: any
  export const forwardRef: any
  export const memo: any
  export const startTransition: any
  export const use: any
  export const useCallback: any
  export const useContext: any
  export const useDebugValue: any
  export const useDeferredValue: any
  export const useEffect: any
  export const useId: any
  export const useImperativeHandle: any
  export const useLayoutEffect: any
  export const useMemo: any
  export const useReducer: any
  export const useRef: any
  export const useState: any
  export const useSyncExternalStore: any
  export const useTransition: any
  export type FC<P = any> = (props: P) => any
  export type ReactNode = any
  export type ReactElement = any
  export type ComponentProps<T = any> = any
  export type Ref<T = any> = any
}

declare module 'react/jsx-runtime' {
  export const Fragment: any
  export const jsx: any
  export const jsxs: any
}

declare module 'react/compiler-runtime' {
  export const c: any
}

declare module 'lodash-es/*.js' {
  const value: any
  export default value
}

declare module 'qrcode' {
  const QRCode: any
  export default QRCode
}

interface PromiseWithResolvers<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}
