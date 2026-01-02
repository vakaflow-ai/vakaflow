# Grid Harmonization Guide

All grids, tables, and data displays across the application now use unified styling for consistent appearance.

## Table Headers

### Background Color
- **Unified Background**: `hsl(217 91% 92%)` - Light blue background
- **CSS Class**: Use `bg-[hsl(217_91%_92%)]` or `.table thead` class
- **Border**: `border-b border-blue-400` - Blue bottom border

### Text Styling
- **Size**: 11px (text-xs)
- **Weight**: Semibold
- **Color**: Blue (`hsl(var(--primary))`)
- **CSS Class**: `.table-header`

### Example
```tsx
<thead className="bg-[hsl(217_91%_92%)]">
  <tr>
    <th className="table-header px-4 py-3 text-left">Column Name</th>
  </tr>
</thead>
```

## Table Body & Rows

### Background Colors
- **Default Row Background**: White (`bg-white`)
- **Hover Background**: `hsl(217 91% 96%)` - Light blue hover
- **Selected Row Background**: `bg-blue-50` - Light blue for selected

### Text Styling
- **Primary Cells**: `.table-cell-primary` - 12px, normal weight, foreground color
- **Secondary Cells**: `.table-cell-secondary` - 12px, normal weight, muted color
- **Meta Cells**: `.table-cell-meta` - 11px, normal weight, muted color

### Example
```tsx
<tbody className="bg-white divide-y divide-gray-200">
  <tr className="hover:bg-primary-50/30 bg-white">
    <td className="px-4 py-2.5">
      <div className="table-cell-primary">Primary Content</div>
      <div className="table-cell-meta">Meta Content</div>
    </td>
  </tr>
</tbody>
```

## Unified Grid Components

### MyActions (Inbox Grid)
- ✅ Headers use `.table-header` with unified blue background
- ✅ Cells use `.table-cell-primary` and `.table-cell-secondary`
- ✅ Hover uses `hover:bg-primary-50/30`

### Tickets Grid
- ✅ Headers use `.table-header` with unified blue background
- ✅ Cells use `.table-cell-primary`, `.table-cell-secondary`, `.table-cell-meta`
- ✅ Hover uses `hover:bg-primary-50/30`

### Assessment Grids
- ✅ Headers use `.table-header` with unified blue background
- ✅ Cells use unified table cell classes
- ✅ Hover uses `hover:bg-primary-50/30`

### Question Library Grid
- ✅ Headers use `.table-header` with unified blue background
- ✅ Cells use `.table-cell-primary` and `.table-cell-secondary`
- ✅ Hover uses `hover:bg-primary-50/30`

## Color Scheme

### Header Colors
- **Background**: `hsl(217 91% 92%)` - Light blue
- **Text**: `hsl(var(--primary))` - Blue
- **Border**: `border-blue-400` - Medium blue

### Body Colors
- **Background**: White
- **Primary Text**: `hsl(var(--foreground))` - Dark gray/black
- **Secondary Text**: `hsl(var(--muted-foreground))` - Medium gray
- **Hover**: `hsl(217 91% 96%)` - Very light blue

### Selected State
- **Background**: `bg-blue-50` - Light blue
- **Text**: Same as normal state

## Best Practices

1. **Always use `.table-header` class** for table headers
2. **Use unified cell classes** (`.table-cell-primary`, `.table-cell-secondary`, `.table-cell-meta`)
3. **Use unified background** `bg-[hsl(217_91%_92%)]` for thead
4. **Use unified hover** `hover:bg-primary-50/30` for rows
5. **Ensure white background** for tbody and rows
6. **Consistent text sizes**: 11px for headers, 12px for body cells

## Migration Checklist

When updating grids:
- [ ] Replace custom header backgrounds with `bg-[hsl(217_91%_92%)]`
- [ ] Use `.table-header` class for all headers
- [ ] Use `.table-cell-primary` / `.table-cell-secondary` / `.table-cell-meta` for cells
- [ ] Update hover to `hover:bg-primary-50/30`
- [ ] Ensure tbody has `bg-white`
- [ ] Remove custom font weights from cells (use unified classes)
- [ ] Remove custom text colors (use unified classes)

