"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useState, useEffect, useMemo } from "react";
import { Search, ArrowUpDown, Package, DollarSign, Eye, Info, ExternalLink } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface Variant {
  id: number;
  variant_id: number;
  title: string;
  price: string;
  sku: string;
  storage?: string;
  condition: string;
  color?: string;
  inventory_quantity: number;
}

interface CompetitorPrice {
  competitor_name: string;
  price: string;
  stock: number;
  created_at: string;
}

interface Product {
  id: number;
  title: string;
  vendor: string;
  product_type: string;
  status: string;
  tags: string[];
  product_created_at: string;
  variants: Variant[];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [competitorPrices, setCompetitorPrices] = useState<CompetitorPrice[]>([]);
  const [loadingCompetitorPrices, setLoadingCompetitorPrices] = useState(false);
  const [isVariantsDialogOpen, setIsVariantsDialogOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'variants' | 'details'>('variants');
  
  // Variant filtering and sorting states
  const [variantSearchTerm, setVariantSearchTerm] = useState("");
  const [variantSortBy, setVariantSortBy] = useState("name");
  const [colorFilter, setColorFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const itemsPerPage = 10;
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCollection = searchParams.get('collection');
  const selectedBrand = searchParams.get('brand');

  // Function to track UI events
  const trackEvent = async (type: string, metadata: string) => {
    try {
      await fetch('/api/ui-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          metadata,
          url: window.location.pathname,
        }),
      });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  };

  // Handle product click - show variants popup
  const handleProductClick = (product: Product) => {
    trackEvent('click', product.title);
    setSelectedProduct(product);
    setSelectedVariant(null);
    setCurrentView('variants');
    // Reset filters when opening new product
    setVariantSearchTerm("");
    setVariantSortBy("name");
    setColorFilter("all");
    setConditionFilter("all");
    setStockFilter("all");
    setIsVariantsDialogOpen(true);
  };

  // Filter and sort variants
  const filteredAndSortedVariants = useMemo(() => {
    if (!selectedProduct) return [];
    
    let filtered = selectedProduct.variants.filter(variant => {
      // Search filter
      const matchesSearch = variant.title.toLowerCase().includes(variantSearchTerm.toLowerCase()) ||
                           variant.sku.toLowerCase().includes(variantSearchTerm.toLowerCase());
      
      // Color filter
      const matchesColor = colorFilter === "all" || variant.color === colorFilter;
      
      // Condition filter
      const matchesCondition = conditionFilter === "all" || variant.condition === conditionFilter;
      
      // Stock filter
      const matchesStock = stockFilter === "all" || 
                          (stockFilter === "in-stock" && variant.inventory_quantity > 0) ||
                          (stockFilter === "out-of-stock" && variant.inventory_quantity === 0);
      
      return matchesSearch && matchesColor && matchesCondition && matchesStock;
    });

    // Sort variants
    filtered.sort((a, b) => {
      switch (variantSortBy) {
        case "name":
          return a.title.localeCompare(b.title);
        case "name-desc":
          return b.title.localeCompare(a.title);
        case "price":
          return parseFloat(a.price) - parseFloat(b.price);
        case "price-desc":
          return parseFloat(b.price) - parseFloat(a.price);
        case "stock":
          return b.inventory_quantity - a.inventory_quantity;
        case "storage":
          return (a.storage || "").localeCompare(b.storage || "");
        default:
          return 0;
      }
    });

    return filtered;
  }, [selectedProduct, variantSearchTerm, variantSortBy, colorFilter, conditionFilter, stockFilter]);

  // Get unique filter options
  const getFilterOptions = useMemo(() => {
    if (!selectedProduct) return { colors: [], conditions: [] };
    
    const colors = [...new Set(selectedProduct.variants.map(v => v.color).filter(Boolean))];
    const conditions = [...new Set(selectedProduct.variants.map(v => v.condition))];
    
    return { colors, conditions };
  }, [selectedProduct]);

  // Handle variant click - show variant details in same dialog
  const handleVariantClick = async (variant: Variant) => {
    trackEvent('click', `${selectedProduct?.title} - ${variant.title}`);
    setSelectedVariant(variant);
    setCurrentView('details');
    
    // Fetch competitor prices for this variant
    setLoadingCompetitorPrices(true);
    try {
      const response = await fetch(`/api/competitor-prices?variantId=${variant.variant_id}`);
      if (response.ok) {
        const data = await response.json();
        setCompetitorPrices(data.competitorPrices || []);
      } else {
        setCompetitorPrices([]);
      }
    } catch (error) {
      console.error('Error fetching competitor prices:', error);
      setCompetitorPrices([]);
    } finally {
      setLoadingCompetitorPrices(false);
    }
  };

  // Handle back to variants
  const handleBackToVariants = () => {
    setSelectedVariant(null);
    setCurrentView('variants');
  };

  // Handle view product page
  const handleViewProductPage = () => {
    if (selectedVariant && selectedProduct) {
      trackEvent('click', `View Product Page - ${selectedProduct.title}`);
      // Create URL matching Shopify format: /products/product-title?variant=shopifyVariantId
      const productSlug = selectedProduct.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .trim();
      
      const productUrl = `https://ozmobiles.com.au/products/${productSlug}?variant=${selectedVariant.variant_id}`;
      window.open(productUrl, '_blank');
    }
  };

  // Redirect if missing required parameters
  useEffect(() => {
    if (!loading && (!selectedCollection || !selectedBrand)) {
      if (!selectedCollection) {
        router.push('/dashboard/collections');
      } else {
        router.push(`/dashboard/collections/brands?collection=${encodeURIComponent(selectedCollection)}`);
      }
      return;
    }
  }, [selectedCollection, selectedBrand, router, loading]);

  useEffect(() => {
    async function loadData() {
      if (!selectedCollection || !selectedBrand) {
        setLoading(false);
        return;
      }

      try {
        // Fetch products from our API route
        const response = await fetch(`/api/products?collection=${encodeURIComponent(selectedCollection)}&brand=${encodeURIComponent(selectedBrand)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        
        const data = await response.json();
        setProducts(data.products || []);
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [selectedCollection, selectedBrand]);

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter(product =>
      product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.variants.some(variant => 
        variant.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        variant.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.title.localeCompare(b.title);
        case "name-desc":
          return b.title.localeCompare(a.title);
        case "price":
          const aPrice = parseFloat(a.variants[0]?.price || '0');
          const bPrice = parseFloat(b.variants[0]?.price || '0');
          return aPrice - bPrice;
        case "price-desc":
          const aPriceDesc = parseFloat(a.variants[0]?.price || '0');
          const bPriceDesc = parseFloat(b.variants[0]?.price || '0');
          return bPriceDesc - aPriceDesc;
        default:
          return 0;
      }
    });

    return filtered;
  }, [products, searchTerm, sortBy]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredAndSortedProducts.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  // Don't render if missing required parameters
  if (!selectedCollection || !selectedBrand) {
    return null;
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b">
            <div className="flex items-center gap-2 px-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/dashboard/collections">
                      Collections
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href={`/dashboard/collections/brands?collection=${encodeURIComponent(selectedCollection)}`}>
                      Brands
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Products</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading products...</p>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b">
          <div className="flex items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard/collections">
                    Collections
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href={`/dashboard/collections/brands?collection=${encodeURIComponent(selectedCollection)}`}>
                    Brands
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Products</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="mb-4">
            <h1 className="text-3xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground mt-2">
              {selectedBrand} products in {selectedCollection} ({products.length} products available)
            </p>
          </div>

          {/* Search and filter section */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="price">Price (Low-High)</SelectItem>
                <SelectItem value="price-desc">Price (High-Low)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results info */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedProducts.length)} of {filteredAndSortedProducts.length} products
            </p>
          </div>

          {/* Products Table */}
          <Card>
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="hidden md:table-cell">Variants</TableHead>
                    <TableHead className="hidden lg:table-cell">Price Range</TableHead>
                    <TableHead className="text-right w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Regular Product Rows */}
                  {paginatedProducts.map((product, index) => {
                    const minPrice = Math.min(...product.variants.map(v => parseFloat(v.price)));
                    const maxPrice = Math.max(...product.variants.map(v => parseFloat(v.price)));
                    const priceRange = minPrice === maxPrice ? `$${minPrice}` : `$${minPrice} - $${maxPrice}`;
                    
                    return (
                      <TableRow key={product.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-muted-foreground">
                          {startIndex + index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-primary/10 to-primary/5 rounded-md flex items-center justify-center flex-shrink-0">
                              <Package className="h-4 w-4 text-primary/60" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{product.title}</div>
                              <div className="text-sm text-muted-foreground">
                                {product.tags.slice(0, 2).map(tag => (
                                  <Badge key={tag} variant="secondary" className="mr-1 text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="text-sm">
                            {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}
                            {product.variants.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {product.variants[0].storage && `${product.variants[0].storage} • `}
                                {product.variants[0].condition}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{priceRange}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary hover:underline"
                            onClick={() => handleProductClick(product)}
                          >
                            View →
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) setCurrentPage(currentPage - 1);
                          }}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      
                      {/* Page numbers */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        const showPage = 
                          page === 1 || 
                          page === totalPages || 
                          (page >= currentPage - 1 && page <= currentPage + 1);
                        
                        if (!showPage) {
                          if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }
                          return null;
                        }

                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(page);
                              }}
                              isActive={currentPage === page}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                      <PaginationItem>
                        <PaginationNext 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                          }}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Empty state for when no products exist */}
          {paginatedProducts.length === 0 && products.length > 0 && (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">No products found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search terms or filters
              </p>
              <Button onClick={() => setSearchTerm("")} variant="outline">
                Clear Search
              </Button>
            </div>
          )}

          {/* Empty state for when API fails */}
          {products.length === 0 && !loading && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No products found</h3>
              <p className="text-muted-foreground mb-4">
                No products found for {selectedBrand} in {selectedCollection}
              </p>
              <Button onClick={() => router.back()} variant="outline">
                Go Back
              </Button>
            </div>
          )}
        </div>

        {/* Unified Dialog with Navigation */}
        <Dialog open={isVariantsDialogOpen} onOpenChange={setIsVariantsDialogOpen}>
          <DialogContent 
            className="w-[95vw] !max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col sm:!max-w-[95vw]"
          >
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                {currentView === 'variants' ? (
                  <>
                    <Package className="h-5 w-5" />
                    {selectedProduct?.title} - Variants
                  </>
                ) : (
                  <>
                    <Info className="h-5 w-5" />
                    {selectedVariant?.title}
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {currentView === 'variants' 
                  ? `Choose from ${selectedProduct?.variants.length} available variants`
                  : 'Complete details for this product variant'
                }
              </DialogDescription>
              {currentView === 'details' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleBackToVariants}
                  className="w-fit mt-2"
                >
                  ← Back to Variants
                </Button>
              )}
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto pr-2">
              {currentView === 'variants' ? (
                <div className="space-y-4">
                  {/* Search and Filters Section */}
                  <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b pb-3">
                    <div className="space-y-3">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          type="text"
                          placeholder="Search variants by name or SKU..."
                          value={variantSearchTerm}
                          onChange={(e) => setVariantSearchTerm(e.target.value)}
                          className="pl-10 h-11 bg-background border-2 focus:border-primary/50 transition-colors text-sm"
                        />
                      </div>
                      
                      {/* Filters Row - Left Aligned with Better Width */}
                      <div className="flex flex-wrap gap-3 items-start">
                        {/* Sort Dropdown */}
                        <div className="w-48">
                          <Select value={variantSortBy} onValueChange={setVariantSortBy}>
                            <SelectTrigger className="h-11 bg-background border-2 hover:border-primary/30 transition-colors text-sm w-full">
                              <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                              <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="name">Name (A-Z)</SelectItem>
                              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                              <SelectItem value="price">Price (Low-High)</SelectItem>
                              <SelectItem value="price-desc">Price (High-Low)</SelectItem>
                              <SelectItem value="stock">Stock (High-Low)</SelectItem>
                              <SelectItem value="storage">Storage</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Color Filter */}
                        {getFilterOptions.colors.length > 0 && (
                          <div className="w-40">
                            <Select value={colorFilter} onValueChange={setColorFilter}>
                              <SelectTrigger className="h-11 bg-background border-2 hover:border-primary/30 transition-colors text-sm w-full">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-400 to-blue-400 mr-2 flex-shrink-0"></div>
                                <SelectValue placeholder="Color" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Colors</SelectItem>
                                {getFilterOptions.colors.map(color => (
                                  <SelectItem key={color} value={color}>{color}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        {/* Condition Filter */}
                        <div className="w-44">
                          <Select value={conditionFilter} onValueChange={setConditionFilter}>
                            <SelectTrigger className="h-11 bg-background border-2 hover:border-primary/30 transition-colors text-sm w-full">
                              <Badge variant="outline" className="w-3 h-3 p-0 mr-2 flex-shrink-0"></Badge>
                              <SelectValue placeholder="Condition" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Conditions</SelectItem>
                              {getFilterOptions.conditions.map(condition => (
                                <SelectItem key={condition} value={condition}>{condition}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Stock Filter */}
                        <div className="w-36">
                          <Select value={stockFilter} onValueChange={setStockFilter}>
                            <SelectTrigger className="h-11 bg-background border-2 hover:border-primary/30 transition-colors text-sm w-full">
                              <Package className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                              <SelectValue placeholder="Stock" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Stock</SelectItem>
                              <SelectItem value="in-stock">In Stock</SelectItem>
                              <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Clear Filters Button - Inline */}
                        {(variantSearchTerm || colorFilter !== "all" || conditionFilter !== "all" || stockFilter !== "all") && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setVariantSearchTerm("");
                              setColorFilter("all");
                              setConditionFilter("all");
                              setStockFilter("all");
                            }}
                            className="h-11 px-4 text-sm hover:bg-muted/80 text-muted-foreground hover:text-foreground ml-2"
                          >
                            Clear All
                          </Button>
                        )}
                      </div>
                      
                      {/* Results Summary - Simplified */}
                      <div className="text-sm text-muted-foreground pt-1">
                        <span className="font-medium text-foreground">{filteredAndSortedVariants.length}</span> of <span className="font-medium text-foreground">{selectedProduct?.variants.length}</span> variants
                      </div>
                    </div>
                  </div>
                  
                  {/* Variants Grid */}
                  {filteredAndSortedVariants.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-4">
                      {filteredAndSortedVariants.map((variant) => (
                    <Card 
                      key={variant.id} 
                      className="group hover:shadow-lg transition-all duration-300 hover:border-primary/30 h-fit bg-card/50 backdrop-blur-sm border-2"
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Header with title and stock status */}
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">{variant.title}</h4>
                            <Badge 
                              variant={variant.inventory_quantity > 0 ? "default" : "destructive"}
                              className="text-xs w-full justify-center py-1"
                            >
                              {variant.inventory_quantity > 0 ? "In Stock" : "Out of Stock"}
                            </Badge>
                          </div>
                          
                          {/* Price - prominent display */}
                          <div className="text-center py-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/10">
                            <div className="text-xs text-muted-foreground mb-1">Price</div>
                            <div className="text-xl font-bold text-primary">${variant.price}</div>
                          </div>
                          
                          {/* Specifications - compact */}
                          <div className="space-y-2 text-xs">
                            {variant.storage && (
                              <div className="flex justify-between items-center p-2 bg-muted/40 rounded-md border">
                                <span className="text-muted-foreground font-medium">Storage</span>
                                <span className="font-semibold">{variant.storage}</span>
                              </div>
                            )}
                            
                            {variant.color && (
                              <div className="flex justify-between items-center p-2 bg-muted/40 rounded-md border">
                                <span className="text-muted-foreground font-medium">Color</span>
                                <span className="font-semibold">{variant.color}</span>
                              </div>
                            )}
                            
                            <div className="flex justify-between items-center p-2 bg-muted/40 rounded-md border">
                              <span className="text-muted-foreground font-medium">Condition</span>
                              <span className="font-semibold">{variant.condition}</span>
                            </div>
                            
                            <div className="flex justify-between items-center p-2 bg-muted/40 rounded-md border">
                              <span className="text-muted-foreground font-medium">Stock</span>
                              <span className="font-semibold">{variant.inventory_quantity}</span>
                            </div>
                          </div>
                          
                          {/* SKU */}
                          {variant.sku && (
                            <div className="pt-2 border-t text-center">
                              <div className="text-xs text-muted-foreground mb-1">SKU</div>
                              <div className="text-xs font-mono bg-muted/30 px-2 py-1 rounded truncate">{variant.sku}</div>
                            </div>
                          )}
                          
                          {/* Action button */}
                          <Button 
                            size="sm" 
                            className={`w-full text-sm h-10 font-medium transition-all duration-200 ${
                              variant.inventory_quantity > 0 
                                ? "hover:bg-primary/90 hover:text-primary-foreground hover:shadow-md" 
                                : "disabled:cursor-not-allowed disabled:hover:bg-secondary"
                            }`}
                            variant={variant.inventory_quantity > 0 ? "default" : "secondary"}
                            disabled={variant.inventory_quantity === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVariantClick(variant);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 px-4">
                  <div className="max-w-md mx-auto">
                    <Package className="h-16 w-16 text-muted-foreground/50 mx-auto mb-6" />
                    <h3 className="text-xl font-semibold mb-3 text-foreground">No variants found</h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      No variants match your current search and filter criteria. Try adjusting your filters or search terms.
                    </p>
                    <Button 
                      onClick={() => {
                        setVariantSearchTerm("");
                        setColorFilter("all");
                        setConditionFilter("all");
                        setStockFilter("all");
                      }} 
                      variant="outline"
                      className="h-10 px-6"
                    >
                      Clear All Filters
                    </Button>
                  </div>
                </div>
              )}
            </div>
              ) : (
                // Variant Details View
                selectedVariant && (
                  <div className="space-y-6 py-4">
                    {/* Price and availability */}
                    <div className="text-center p-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg">
                      <div className="text-3xl font-bold text-primary mb-2">${selectedVariant.price}</div>
                      <Badge 
                        variant={selectedVariant.inventory_quantity > 0 ? "default" : "destructive"}
                        className="text-sm"
                      >
                        {selectedVariant.inventory_quantity > 0 
                          ? `${selectedVariant.inventory_quantity} in stock` 
                          : "Out of stock"
                        }
                      </Badge>
                    </div>
                    
                    {/* Specifications */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-semibold mb-3 text-lg">Specifications</h3>
                        <div className="space-y-3">
                          {selectedVariant.storage && (
                            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                              <span className="text-muted-foreground">Storage</span>
                              <span className="font-semibold">{selectedVariant.storage}</span>
                            </div>
                          )}
                          
                          {selectedVariant.color && (
                            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                              <span className="text-muted-foreground">Color</span>
                              <span className="font-semibold">{selectedVariant.color}</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-muted-foreground">Condition</span>
                            <span className="font-semibold">{selectedVariant.condition}</span>
                          </div>
                          
                          {selectedVariant.sku && (
                            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                              <span className="text-muted-foreground">SKU</span>
                              <span className="font-mono text-sm">{selectedVariant.sku}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold mb-3 text-lg">Product Information</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-muted-foreground">Product</span>
                            <span className="font-semibold text-right">{selectedProduct?.title}</span>
                          </div>
                          
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-muted-foreground">Brand</span>
                            <span className="font-semibold">{selectedProduct?.vendor}</span>
                          </div>
                          
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-muted-foreground">Category</span>
                            <span className="font-semibold">{selectedProduct?.product_type}</span>
                          </div>
                          
                          {selectedProduct?.tags && selectedProduct.tags.length > 0 && (
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <div className="flex items-start gap-2">
                                <span className="text-muted-foreground flex-shrink-0 pt-0.5">Tags</span>
                                <div className="flex flex-wrap gap-1">
                                  {selectedProduct.tags.map((tag, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Competitor Prices Section */}
                    <div>
                      <h3 className="font-semibold mb-3 text-lg flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        Competitor Prices
                      </h3>
                      {loadingCompetitorPrices ? (
                        <div className="p-6 bg-muted/30 rounded-lg text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary mx-auto mb-2"></div>
                          <p className="text-sm text-muted-foreground">Loading competitor prices...</p>
                        </div>
                      ) : competitorPrices.length > 0 ? (
                        <div className="space-y-3">
                          {competitorPrices.map((competitor, index) => (
                            <div 
                              key={index} 
                              className="p-4 bg-gradient-to-r from-muted/40 to-muted/20 rounded-lg border border-muted hover:border-primary/30 transition-colors"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className="font-semibold text-base">{competitor.competitor_name}</h4>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Updated: {new Date(competitor.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-primary">${competitor.price}</div>
                                  <Badge 
                                    variant={competitor.stock > 0 ? "default" : "destructive"}
                                    className="text-xs mt-1"
                                  >
                                    {competitor.stock > 0 ? `${competitor.stock} in stock` : "Out of stock"}
                                  </Badge>
                                </div>
                              </div>
                              
                              {/* Price comparison */}
                              {selectedVariant && (
                                <div className="mt-3 pt-3 border-t border-muted">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Price difference:</span>
                                    <span className={`font-semibold ${
                                      parseFloat(competitor.price) < parseFloat(selectedVariant.price)
                                        ? 'text-red-500'
                                        : parseFloat(competitor.price) > parseFloat(selectedVariant.price)
                                        ? 'text-green-500'
                                        : 'text-muted-foreground'
                                    }`}>
                                      {parseFloat(competitor.price) < parseFloat(selectedVariant.price)
                                        ? `$${(parseFloat(selectedVariant.price) - parseFloat(competitor.price)).toFixed(2)} cheaper`
                                        : parseFloat(competitor.price) > parseFloat(selectedVariant.price)
                                        ? `$${(parseFloat(competitor.price) - parseFloat(selectedVariant.price)).toFixed(2)} more expensive`
                                        : 'Same price'
                                      }
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 bg-muted/30 rounded-lg text-center">
                          <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">No competitor pricing data available</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Button 
                        onClick={handleViewProductPage}
                        className="flex-1 cursor-pointer"
                        disabled={!selectedVariant}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Product Page
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}