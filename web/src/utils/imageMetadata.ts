import imageMetadata from '../data/image-metadata.json';

type ImageMetadata = {
  width: number;
  height: number;
  type: string;
};

const metadata = imageMetadata as Record<string, ImageMetadata>;

export function imageAttrs(src: string | undefined) {
  if (!src) return {};
  const image = metadata[src];
  if (!image) return {};
  return {
    width: image.width,
    height: image.height,
  };
}
