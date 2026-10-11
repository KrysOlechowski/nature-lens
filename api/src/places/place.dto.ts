import type {
  Place,
  PlaceBoundingBox,
  PlaceCenter,
  PlaceType,
} from "./place.model.js";

class PlaceCenterDto {
  readonly longitude: number;
  readonly latitude: number;

  constructor(center: PlaceCenter) {
    this.longitude = center.longitude;
    this.latitude = center.latitude;
  }
}

class PlaceBoundingBoxDto {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;

  constructor(boundingBox: PlaceBoundingBox) {
    this.west = boundingBox.west;
    this.south = boundingBox.south;
    this.east = boundingBox.east;
    this.north = boundingBox.north;
  }
}

export class PlaceDto {
  readonly id: string;
  readonly slug: string;
  readonly label: string;
  readonly type: PlaceType;
  readonly center: PlaceCenterDto;
  readonly bbox: PlaceBoundingBoxDto | null;

  constructor(place: Place) {
    this.id = place.id;
    this.slug = place.slug;
    this.label = place.label;
    this.type = place.type;
    this.center = new PlaceCenterDto(place.center);
    this.bbox = place.bbox ? new PlaceBoundingBoxDto(place.bbox) : null;
  }
}
