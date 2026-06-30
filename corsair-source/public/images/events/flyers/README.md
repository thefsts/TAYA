# Corsair Event Flyers

Drop real event flyer images (JPG, PNG, or PDF export as image) into this folder.

Reference them in `src/data/events.ts` under `eventFlyers`:

```ts
{
  id: 'flyer-xxx',
  title: 'Your Event Title',
  image: '/images/events/flyers/your-flyer.jpg',
  downloadUrl: '/images/events/flyers/your-flyer.pdf', // optional
}
```

Flyers render with `object-contain` so the full flyer layout is preserved — never cropped.
