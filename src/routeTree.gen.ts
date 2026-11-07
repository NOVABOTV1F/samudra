/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as ApiChatRouteImport } from './routes/api/chat'
import { Route as ApiImageRouteImport } from './routes/api/image'
import { Route as ApiAccessRouteImport } from './routes/api/access'
import { Route as ApiStatusRouteImport } from './routes/api/status'

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)
const ApiChatRoute = ApiChatRouteImport.update({
  id: '/api/chat',
  path: '/api/chat',
  getParentRoute: () => rootRouteImport,
} as any)
const ApiImageRoute = ApiImageRouteImport.update({
  id: '/api/image',
  path: '/api/image',
  getParentRoute: () => rootRouteImport,
} as any)
const ApiAccessRoute = ApiAccessRouteImport.update({
  id: '/api/access',
  path: '/api/access',
  getParentRoute: () => rootRouteImport,
} as any)
const ApiStatusRoute = ApiStatusRouteImport.update({
  id: '/api/status',
  path: '/api/status',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/api/chat': typeof ApiChatRoute
  '/api/image': typeof ApiImageRoute
  '/api/access': typeof ApiAccessRoute
  '/api/status': typeof ApiStatusRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/api/chat': typeof ApiChatRoute
  '/api/image': typeof ApiImageRoute
  '/api/access': typeof ApiAccessRoute
  '/api/status': typeof ApiStatusRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/api/chat': typeof ApiChatRoute
  '/api/image': typeof ApiImageRoute
  '/api/access': typeof ApiAccessRoute
  '/api/status': typeof ApiStatusRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/api/chat' | '/api/image' | '/api/access' | '/api/status'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/api/chat' | '/api/image' | '/api/access' | '/api/status'
  id: '__root__' | '/' | '/api/chat' | '/api/image' | '/api/access' | '/api/status'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  ApiChatRoute: typeof ApiChatRoute
  ApiImageRoute: typeof ApiImageRoute
  ApiAccessRoute: typeof ApiAccessRoute
  ApiStatusRoute: typeof ApiStatusRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/api/chat': {
      id: '/api/chat'
      path: '/api/chat'
      fullPath: '/api/chat'
      preLoaderRoute: typeof ApiChatRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/api/image': {
      id: '/api/image'
      path: '/api/image'
      fullPath: '/api/image'
      preLoaderRoute: typeof ApiImageRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/api/access': {
      id: '/api/access'
      path: '/api/access'
      fullPath: '/api/access'
      preLoaderRoute: typeof ApiAccessRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/api/status': {
      id: '/api/status'
      path: '/api/status'
      fullPath: '/api/status'
      preLoaderRoute: typeof ApiStatusRouteImport
      parentRoute: typeof rootRouteImport
    }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  ApiChatRoute: ApiChatRoute,
  ApiImageRoute: ApiImageRoute,
  ApiAccessRoute: ApiAccessRoute,
  ApiStatusRoute: ApiStatusRoute,
}
export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

import type { getRouter } from './router.tsx'
import type { createStart } from '@tanstack/react-start'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
