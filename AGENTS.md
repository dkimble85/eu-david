# AGENTS.md

AI agents working on this project should read this file for context and current priorities.

## Project Overview

**Name**: EU David  
**Description**: Mobile app to check food products for EU additive compliance via barcode scanning  
**Platform**: iOS (Expo/React Native)  
**Tech Stack**: Expo SDK 54, React Native 0.81.5, Supabase, Expo Router, Open Food Facts API

## Current Status

- Barcode scanner functional on iOS simulator
- Scanner page UI complete with logo
- Product detail page skeleton exists
- Auth screens (login/register) built but incomplete
- History/Profile pages need implementation
- EU additives database has limited entries (~50)

## High Priority Tasks

### [x] 1. Fix Logo Image Centering

- **Location**: `app/(tabs)/index.tsx`
- **Issue**: Logo image not perfectly centered on iPhone 17 Simulator
- **Current**: Uses absolute positioning with manual margins
- **Goal**: Center logo properly across all device sizes

### [ ] 2. Complete Product Detail Page

- **Location**: `app/product/[barcode].tsx`
- **Needs**:
  - Display product info from Open Food Facts API
  - Parse and display ingredients list
  - Check ingredients against EU additives database
  - Show status badges (banned/restricted/warning/approved)

### [ ] 3. Product Caching with TanStack Query

- **Scope**: Cache Open Food Facts API responses by barcode so repeated scans of the same product skip the network
- **Install**: `npx expo install @tanstack/react-query`
- **Setup**: Wrap the root layout in `app/_layout.tsx` with `QueryClientProvider`:
  ```tsx
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  const queryClient = new QueryClient();
  // wrap <GestureHandlerRootView> with <QueryClientProvider client={queryClient}>
  ```
- **Hook**: Create `hooks/useProduct.ts`:
  ```ts
  export function useProduct(barcode: string) {
    return useQuery({
      queryKey: ['product', barcode],
      queryFn: () => getProductByBarcode(barcode),
      staleTime: Infinity, // product data doesn't change
    });
  }
  ```
- **Integration**: Update `app/product/[barcode].tsx` to call `useProduct(barcode)` instead of calling `getProductByBarcode` directly in a `useEffect`
- **Scope boundary**: Keep `useAuth` and `useScanner` as-is — TanStack Query is only for server/API state

### [ ] 4. Implement History Page

- **Location**: `app/(tabs)/history.tsx`
- **Needs**:
  - Fetch scan history from Supabase
  - Display list of previously scanned products
  - Tap to view product details
  - Handle empty state

### [ ] 4. Build and Test on Physical Device

- **Command**: `npx expo run:ios --device`
- **Needs**: Camera permission for barcode scanning
- **Verify**: Barcode scanning works on real iPhone

### [ ] 5. Complete Authentication Flow

- **Locations**: `app/(auth)/login.tsx`, `app/(auth)/register.tsx`
- **Needs**:
  - Email/password sign up with Supabase
  - Email verification flow
  - Session management
  - Logout functionality

## Medium Priority Tasks

### [ ] 6. Replace Deprecated SafeAreaView

- **Issue**: "SafeAreaView has been deprecated" warning
- **Solution**: Use `react-native-safe-area-context` directly
- **Files**: All screen components

### [ ] 7. Add Error Handling

- **APIs**: Open Food Facts, Supabase
- **Needs**: User-friendly error messages, retry options

### [ ] 8. Add Loading States

- **Needs**: Skeleton loaders or spinners for:
  - Product lookup
  - Auth operations
  - History load

### [ ] 9. Expand EU Additives Database

- **Location**: `data/eu-additives.json`
- **Source**: EC Regulation No 1333/2008
- **Needs**: Add more additives, especially common ones (BHA, BHT, artificial sweeteners, etc.)

## Testing

### [ ] E2E Testing with Maestro

- **Install**: Download the Maestro CLI — `curl -Ls "https://get.maestro.mobile.dev" | bash`
- **Runs against**: A running iOS Simulator build (`npx expo run:ios`)
- **Flow files location**: `.maestro/` directory at project root
- **Key flows to write**:

  | File | Flow |
  | ---- | ---- |
  | `.maestro/scan_barcode.yaml` | Launch app → tap Start Scanning → assert camera view appears |
  | `.maestro/auth_login.yaml` | Launch app → enter email/password → tap Sign In → assert tab bar appears |
  | `.maestro/auth_register.yaml` | Launch app → tap Sign Up → fill form → assert confirmation state |
  | `.maestro/product_detail.yaml` | Navigate to product page with a known barcode → assert product name and additive badges render |
  | `.maestro/history.yaml` | Sign in → scan a product → navigate to History tab → assert scanned product appears |

- **Run a flow**: `maestro test .maestro/auth_login.yaml`
- **Run all flows**: `maestro test .maestro/`
- **Note**: Barcode scanning flows will need Maestro's `tapOn` to trigger the scan via a mocked barcode or a test input, since the camera can't scan a real barcode in the simulator. Consider adding a dev-only text input that accepts a barcode string to bypass the camera in test environments.

## Technical Debt

### Package Upgrades

- `react-native-reanimated`: 3.16.7 → ~4.1.1 (Expo SDK 54 compatible)
- `@types/react`: 18.3.28 → ~19.1.10
- `typescript`: 5.3.3 → ~5.9.2

### Build/Deployment

- Configure EAS for App Store distribution
- Optimize app icon (currently uses full-size PNG)
- Set up TestFlight testing

## Environment Variables

Required in `.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
FATSECRET_CLIENT_ID=your-client-id
FATSECRET_CLIENT_SECRET=your-client-secret
```

## Key Files

| File                        | Purpose                     |
| --------------------------- | --------------------------- |
| `app/(tabs)/index.tsx`      | Scanner page                |
| `app/product/[barcode].tsx` | Product detail              |
| `app/(tabs)/history.tsx`    | Scan history                |
| `app/(tabs)/profile.tsx`    | User profile                |
| `app/(auth)/login.tsx`      | Login screen                |
| `app/(auth)/register.tsx`   | Register screen             |
| `data/eu-additives.json`    | EU additive database        |
| `lib/openfoodfacts.ts`      | Open Food Facts API client  |
| `lib/eu-check.ts`           | Additive checking logic     |
| `lib/supabase.ts`           | Supabase client             |
| `hooks/useScanner.ts`       | Barcode scanner hook        |
| `hooks/useAuth.ts`          | Authentication hook         |
| `constants/theme.ts`        | Colors, spacing, typography |

## API References

- **Open Food Facts**: `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
- **Supabase**: `https://supabase.com/docs/guides/auth`
- **EU Regulations**: EC Regulation No 1333/2008

## Commands

```bash
# Start development
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on physical device
npx expo run:ios --device

# Build for iOS
npx expo prebuild && cd ios && xcodebuild

# Lint
npm run lint

# Type check
npm run type-check
```

## Notes for AI Agents

- Use `expo-router` for file-based routing
- All UI components use styling from `constants/theme.ts`
- Additive status types: `banned`, `restricted`, `warning`, `approved`, `unknown`
- Dark theme by default
- Expo Go compatible (no custom native modules)
