declare module 'react-map-gl/mapbox' {
  import type { CSSProperties, ReactNode } from 'react';

  export interface ViewState {
    latitude: number;
    longitude: number;
    zoom: number;
    bearing?: number;
    pitch?: number;
    padding?: { top: number; bottom: number; left: number; right: number };
  }

  export interface MapProps {
    initialViewState?: ViewState;
    mapboxAccessToken?: string;
    mapStyle?: string;
    style?: CSSProperties;
    children?: ReactNode;
    onMove?: (evt: { viewState: ViewState }) => void;
    onClick?: (evt: any) => void;
  }

  export interface SourceProps {
    id: string;
    type: string;
    data: any;
    children?: ReactNode;
  }

  export interface LayerProps {
    id: string;
    type: string;
    paint?: Record<string, any>;
    layout?: Record<string, any>;
    filter?: any[];
  }

  export interface MarkerProps {
    latitude: number;
    longitude: number;
    anchor?: string;
    onClick?: (evt: { originalEvent: MouseEvent }) => void;
    children?: ReactNode;
  }

  export interface PopupProps {
    latitude: number;
    longitude: number;
    anchor?: string;
    onClose?: () => void;
    closeOnClick?: boolean;
    maxWidth?: string;
    children?: ReactNode;
  }

  export interface NavigationControlProps {
    position?: string;
  }

  export default function Map(props: MapProps): JSX.Element;
  export function Source(props: SourceProps): JSX.Element;
  export function Layer(props: LayerProps): JSX.Element;
  export function Marker(props: MarkerProps): JSX.Element;
  export function Popup(props: PopupProps): JSX.Element;
  export function NavigationControl(props: NavigationControlProps): JSX.Element;
}
