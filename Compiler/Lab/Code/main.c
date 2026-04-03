#include "ast.h"
#include <stdio.h>

extern FILE *yyin;
extern int yyparse(void);
extern ASTNode *root;
extern int has_lexical_error;
extern int has_syntax_error;

int main(int argc, char **argv) {
  if (argc != 2) {
    fprintf(stderr, "Usage: %s <input file>\n", argv[0]);
    return 1;
  }

  yyin = fopen(argv[1], "r");
  if (yyin == NULL) {
    perror(argv[1]);
    return 1;
  }

  yyparse();
  fclose(yyin);

  if (!has_lexical_error && !has_syntax_error && root != NULL) {
    print_ast(root, 0);
  }

  free_ast(root);
  return 0;
}
