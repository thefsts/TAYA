// Ambient module declarations for uppercase-extension image assets
// (vite/client's built-in "*.png" pattern is case-sensitive and does not
// match files uploaded with an uppercase extension like ".PNG").
declare module "*.PNG" {
  const src: string;
  export default src;
}
