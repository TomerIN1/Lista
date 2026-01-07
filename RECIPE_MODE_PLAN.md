# Recipe Mode Implementation Plan

## Overview
Add recipe organization mode to Lista app, allowing users to input multiple recipes, combine duplicate ingredients across recipes, and display colored badges showing which recipe(s) each item belongs to.

## User Requirements
1. **Mode Toggle**: Switch between "Items" (default) and "Recipe" mode
2. **Recipe Input**: Multiple expandable recipe cards with name + ingredients fields
3. **Duplicate Handling**: Combine quantities (e.g., "2 eggs + 3 eggs = 5 eggs [Recipe A, Recipe B]")
4. **Badge Display**: Small colored badges next to items showing recipe association
5. **Mixed Mode**: Allow both recipes and regular items in same list

---

## Implementation Phases

### Phase 1: Data Foundation
**Goal**: Update type system and data models (no UI changes yet)

**Files to modify**:
- `types.ts` - Add new interfaces and types

**Changes**:
```typescript
// New types
export type InputMode = 'items' | 'recipe';

export interface Recipe {
  id: string;
  name: string;
  ingredients: string;
}

export interface RecipeLabel {
  recipeId: string;
  recipeName: string;
  color: string; // Hex color for badge
}

// Update existing Item interface
export interface Item {
  id: string;
  name: string;
  checked: boolean;
  amount: number;
  unit: Unit;
  recipeLabels?: RecipeLabel[]; // NEW: array of recipes
}

// Update existing ListDocument interface
export interface ListDocument {
  // ... existing fields
  recipes?: Recipe[]; // NEW
  inputMode?: InputMode; // NEW
}
```

**Backward compatibility**: All new fields are optional, existing lists work unchanged

---

### Phase 2: AI Service Updates
**Goal**: Add recipe processing and item combining logic

**Files to modify**:
- `services/geminiService.ts`

**New function**:
```typescript
export const organizeRecipes = async (
  recipes: Recipe[],
  language: Language,
  existingCategories?: string[]
): Promise<CategoryGroup[]>
```

**Key logic**:
1. **Generate unique colors** for each recipe (consistent hash-based palette)
2. **Build AI prompt** requesting ingredient extraction with quantities/units
3. **Parse response** including recipeIds for each item
4. **Combine duplicates**: Items with same name+unit get merged amounts
5. **Attach recipe labels** with colors to each item

**AI Prompt strategy**:
```
"You are organizing multiple recipes into a shopping list.
Extract ingredients with quantities from each recipe.
Combine duplicate ingredients across recipes by summing quantities.
Return JSON with categories and items including recipeIds array."
```

**Helper functions**:
```typescript
// Generate consistent color for recipe based on ID
const generateRecipeColor = (recipeId: string): string => { /* ... */ }

// Combine items with same name+unit, merge recipe labels
const combineItems = (items: Item[]): Item[] => { /* ... */ }
```

---

### Phase 3: Recipe Input UI
**Goal**: Add recipe mode to InputArea component

**Files to modify**:
- `components/InputArea.tsx`
- `constants/translations.ts` (add recipe mode translations)

**New component to create**:
- `components/RecipeInputCard.tsx` - Individual recipe card UI

**InputArea changes**:
1. **Mode toggle** at top (radio buttons: Items / Recipe)
2. **Conditional rendering**:
   - Items mode: Current single textarea (unchanged)
   - Recipe mode: Array of RecipeInputCard components
3. **New state**:
   ```typescript
   const [recipes, setRecipes] = useState<Recipe[]>([{id: uuid(), name: '', ingredients: ''}])
   ```
4. **Add/Remove recipe buttons**
5. **Updated submit logic**: Call `onOrganizeRecipes(recipes)` in recipe mode

**RecipeInputCard structure**:
- Recipe number badge (Recipe 1, Recipe 2, etc.)
- Recipe name input field
- Ingredients textarea (multiline)
- Delete button (except for first recipe)
- Soft green background to distinguish from items mode

---

### Phase 4: Recipe Badge Display
**Goal**: Show colored badges next to items with recipe associations

**Files to modify**:
- `components/CategoryItem.tsx`

**New component to create**:
- `components/RecipeBadge.tsx` - Reusable badge component

**CategoryItem changes**:
After item name, render badges if `item.recipeLabels` exists:
```typescript
{item.recipeLabels?.map(label => (
  <RecipeBadge
    label={label}
    key={label.recipeId}
  />
))}
```

**Badge design**:
- Pill-shaped with rounded corners
- Recipe initials or short name (max 2 chars)
- Background color from `label.color` (20% opacity)
- Border in same color (40% opacity)
- 10px font size
- Max 3 badges visible, "+N more" if needed
- Hover shows full recipe name via title attribute

**Example**: `☐ Eggs [PA] [CS] 5 pcs` where PA=blue, CS=green

---

### Phase 5: App Integration
**Goal**: Wire up recipe mode in main app logic

**Files to modify**:
- `App.tsx`
- `services/firestoreService.ts`

**App.tsx new state**:
```typescript
const [inputMode, setInputMode] = useState<InputMode>('items');
const [recipes, setRecipes] = useState<Recipe[]>([]);
```

**New handlers**:
```typescript
const handleOrganizeRecipes = async (recipes: Recipe[], name: string) => {
  // 1. Set loading state
  // 2. Create list if needed (logged in users)
  // 3. Call organizeRecipes() from geminiService
  // 4. Update localGroups and recipes state
  // 5. Save to Firestore with recipes and inputMode
  // 6. Set success state
}

const handleAddRecipes = async (newRecipes: Recipe[]) => {
  // Merge with existing recipes, re-organize all
}
```

**Sync with Firestore**:
```typescript
useEffect(() => {
  if (activeList) {
    setInputMode(activeList.inputMode || 'items');
    setRecipes(activeList.recipes || []);
  }
}, [activeListId, lists]);
```

**Firestore service new function**:
```typescript
export const updateListGroupsAndRecipes = async (
  listId: string,
  groups: CategoryGroup[],
  recipes: Recipe[],
  mode: InputMode
) => {
  await updateDoc(listRef, {
    groups,
    recipes,
    inputMode: mode,
    updatedAt: Date.now()
  });
}
```

---

### Phase 6: Result Display Enhancements
**Goal**: Show recipe metadata in organized list view

**Files to modify**:
- `components/ResultCard.tsx`

**Changes**:
1. **Recipe mode indicator** at top: "Recipe Mode • 3 recipes combined"
2. **View Recipes button**: Opens modal showing original recipes
3. **Updated copy function**: Include recipe breakdown in copied text

**Optional new component**:
- `components/RecipeBreakdownModal.tsx` - Shows original recipes

---

### Phase 7: Translations
**Goal**: Add i18n support for recipe mode

**File to modify**:
- `constants/translations.ts`

**Add translations**:
```typescript
input: {
  modeItems: "Items Mode" / "מצב פריטים",
  modeRecipe: "Recipe Mode" / "מצב מתכונים",
  recipeName: "Recipe Name" / "שם המתכון",
  recipeIngredients: "Ingredients" / "מרכיבים",
  addRecipe: "Add Another Recipe" / "הוסף מתכון נוסף",
  removeRecipe: "Remove Recipe" / "הסר מתכון",
},
result: {
  recipeMode: "Recipe Mode" / "מצב מתכונים",
  recipesUsed: "recipes combined" / "מתכונים משולבים",
}
```

---

## Key Algorithms

### 1. Item Combining (Duplicate Detection)
```typescript
const combineItems = (items: Item[]): Item[] => {
  const itemMap = new Map<string, Item>();

  items.forEach(item => {
    const key = `${item.name.toLowerCase().trim()}_${item.unit}`;

    if (itemMap.has(key)) {
      const existing = itemMap.get(key)!;
      existing.amount += item.amount;
      existing.recipeLabels = [
        ...(existing.recipeLabels || []),
        ...(item.recipeLabels || [])
      ];
    } else {
      itemMap.set(key, { ...item });
    }
  });

  return Array.from(itemMap.values());
};
```

### 2. Recipe Color Generation
```typescript
const generateRecipeColor = (recipeId: string): string => {
  const colors = [
    '#6366F1', // indigo
    '#10B981', // emerald
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
  ];
  const hash = recipeId.split('').reduce((acc, char) =>
    acc + char.charCodeAt(0), 0
  );
  return colors[hash % colors.length];
};
```

---

## Edge Cases

### 1. Same Item, Different Units
**Problem**: Recipe A has "2 L milk", Recipe B has "500 ml milk"

**Solution**: Include unit conversion in AI prompt:
```
"Convert measurements to consistent units before combining:
 - ml/L → use L for amounts > 1000ml
 - g/kg → use kg for amounts > 1000g"
```

### 2. Empty Recipe Fields
**Problem**: User submits recipe with empty name or ingredients

**Solution**: Validation before submit:
- Empty name → default to "Recipe 1", "Recipe 2"
- Empty ingredients → show error, block submit

### 3. Maximum Recipes
**Limit**: 10 recipes max (UX + AI token considerations)

**Behavior**: Disable "Add Recipe" button at 10, show warning at 8

### 4. Mixed Mode (Recipes + Regular Items)
**Scenario**: User adds recipes, then wants to add regular items

**Solution**:
- Allow both modes in same list
- Regular items have no `recipeLabels` field
- Recipe items have `recipeLabels` array
- Both display in same CategoryCard, badges show only for recipe items

### 5. Real-time Sync Conflicts
**Scenario**: User A adds recipes, User B adds items simultaneously

**Solution**:
- Firestore handles document-level conflicts
- Last write wins for mode field
- Client always uses latest Firestore snapshot
- Optional: Show notification "List switched to recipe mode by [user]"

---

## Critical Files for Implementation

1. **types.ts** - Must be done first; defines all new data structures
2. **services/geminiService.ts** - Core recipe processing and AI integration
3. **components/InputArea.tsx** - Primary user entry point for recipe mode
4. **App.tsx** - State management and orchestration
5. **components/CategoryItem.tsx** - Visual display of recipe badges

---

## Testing Checklist

### Basic Flow
- [ ] Switch to recipe mode
- [ ] Add 2 recipes with overlapping ingredients (e.g., both need eggs)
- [ ] Verify quantities combine correctly (2 + 3 = 5)
- [ ] Verify colored badges appear
- [ ] Verify each recipe has different color
- [ ] Copy list and check format includes recipe info

### Edge Cases
- [ ] Add recipe with no name (defaults to "Recipe 1")
- [ ] Try to add 11th recipe (blocked at 10)
- [ ] Add recipe with special characters (Hebrew, emojis)
- [ ] Add recipe then switch back to items mode
- [ ] Mix recipes and regular items in same list
- [ ] Share recipe list with another user
- [ ] Guest mode: Create recipe list, verify works without login

### Mobile
- [ ] Recipe cards responsive on mobile
- [ ] Badges wrap properly when many recipes
- [ ] Mode toggle accessible on small screens
- [ ] Touch targets meet 44x44px minimum

### Persistence
- [ ] Create recipe list (logged in)
- [ ] Reload page
- [ ] Verify recipes and mode restored
- [ ] Verify badges still show correct colors

---

## Success Metrics

✅ **User can switch to recipe mode**
✅ **User can add multiple recipes with names and ingredients**
✅ **AI combines duplicate items across recipes**
✅ **Items display colored badges showing recipe associations**
✅ **Lists persist recipe data to Firestore**
✅ **Feature works for both logged-in and guest users**
✅ **Existing lists without recipes continue to work unchanged**
✅ **Recipe mode works in both English and Hebrew**
