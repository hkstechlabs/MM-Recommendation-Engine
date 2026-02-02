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
  const [isVariantsDialogOpen, setIsVariantsDialogOpen] = useState(false);
  const [isVariantDetailsDialogOpen, setIsVariantDetailsDialogOpen] = useState(false);
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
    setIsVariantsDialogOpen(true);
  };

  // Handle variant click - show variant details
  const handleVariantClick = (variant: Variant) => {
    trackEvent('click', `${selectedProduct?.title} - ${variant.title}`);
    setSelectedVariant(variant);
    setIsVariantDetailsDialogOpen(true);
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

        {/* Variants Dialog */}
        <Dialog open={isVariantsDialogOpen} onOpenChange={setIsVariantsDialogOpen}>
          <DialogContent 
            className="w-[95vw] !max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col sm:!max-w-[95vw]"
          >
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {selectedProduct?.title} - Variants
              </DialogTitle>
              <DialogDescription>
                Choose from {selectedProduct?.variants.length} available variants
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-10 gap-3 py-4">
                {selectedProduct?.variants.map((variant) => (
                  <Card 
                    key={variant.id} 
                    className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50 h-fit"
                    onClick={() => handleVariantClick(variant)}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        {/* Header with title and stock status */}
                        <div className="space-y-1">
                          <h4 className="font-semibold text-xs leading-tight line-clamp-2">{variant.title}</h4>
                          <Badge 
                            variant={variant.inventory_quantity > 0 ? "default" : "destructive"}
                            className="text-xs w-full justify-center"
                          >
                            {variant.inventory_quantity > 0 ? "In Stock" : "Out of Stock"}
                          </Badge>
                        </div>
                        
                        {/* Price - prominent display */}
                        <div className="text-center py-2 bg-primary/5 rounded-lg">
                          <div className="text-xs text-muted-foreground">Price</div>
                          <div className="text-lg font-bold text-primary">${variant.price}</div>
                        </div>
                        
                        {/* Specifications - compact */}
                        <div className="space-y-1 text-xs">
                          {variant.storage && (
                            <div className="flex justify-between items-center p-1 bg-muted/30 rounded">
                              <span className="text-muted-foreground">Storage</span>
                              <span className="font-medium">{variant.storage}</span>
                            </div>
                          )}
                          
                          {variant.color && (
                            <div className="flex justify-between items-center p-1 bg-muted/30 rounded">
                              <span className="text-muted-foreground">Color</span>
                              <span className="font-medium">{variant.color}</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center p-1 bg-muted/30 rounded">
                            <span className="text-muted-foreground">Condition</span>
                            <span className="font-medium">{variant.condition}</span>
                          </div>
                          
                          <div className="flex justify-between items-center p-1 bg-muted/30 rounded">
                            <span className="text-muted-foreground">Stock</span>
                            <span className="font-medium">{variant.inventory_quantity}</span>
                          </div>
                        </div>
                        
                        {/* SKU */}
                        {variant.sku && (
                          <div className="pt-1 border-t text-center">
                            <div className="text-xs text-muted-foreground">SKU</div>
                            <div className="text-xs font-mono truncate">{variant.sku}</div>
                          </div>
                        )}
                        
                        {/* Action button */}
                        <Button 
                          size="sm" 
                          className="w-full text-xs h-8"
                          variant={variant.inventory_quantity > 0 ? "default" : "secondary"}
                          disabled={variant.inventory_quantity === 0}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Variant Details Dialog */}
        <Dialog open={isVariantDetailsDialogOpen} onOpenChange={setIsVariantDetailsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                {selectedVariant?.title}
              </DialogTitle>
              <DialogDescription>
                Complete details for this product variant
              </DialogDescription>
            </DialogHeader>
            
            {selectedVariant && (
              <div className="flex-1 overflow-y-auto pr-2">
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
                      </div>
                      
                      {selectedProduct?.tags && selectedProduct.tags.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-semibold mb-2">Tags</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedProduct.tags.slice(0, 6).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button 
                      className="flex-1"
                      size="lg"
                      onClick={handleViewProductPage}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Product Page
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      size="lg"
                      onClick={() => setIsVariantDetailsDialogOpen(false)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Back to Variants
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}