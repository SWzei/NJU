#include "ast.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char *dup_cstr(const char *src) {
  char *dst;
  size_t len;

  if (src == NULL) {
    return NULL;
  }

  len = strlen(src) + 1;
  dst = (char *)malloc(len);
  if (dst == NULL) {
    fprintf(stderr, "Out of memory\n");
    exit(1);
  }
  memcpy(dst, src, len);
  return dst;
}

ASTNode *new_node(NodeType type, const char *name, int line) {
  ASTNode *node = (ASTNode *)malloc(sizeof(ASTNode));

  if (node == NULL) {
    fprintf(stderr, "Out of memory\n");
    exit(1);
  }

  node->type = type;
  node->name = dup_cstr(name);
  node->line = line;
  node->value_kind = AST_VALUE_NONE;
  node->text = NULL;
  node->int_val = 0;
  node->float_val = 0.0f;
  node->children = NULL;
  node->child_count = 0;
  node->child_capacity = 0;
  return node;
}

ASTNode *new_terminal(const char *name, int line) {
  return new_node(NODE_TERMINAL, name, line);
}

ASTNode *new_terminal_id(const char *lexeme, int line) {
  ASTNode *node = new_terminal("ID", line);

  node->value_kind = AST_VALUE_ID;
  node->text = dup_cstr(lexeme);
  return node;
}

ASTNode *new_terminal_type(const char *type_name, int line) {
  ASTNode *node = new_terminal("TYPE", line);

  node->value_kind = AST_VALUE_TYPE;
  node->text = dup_cstr(type_name);
  return node;
}

ASTNode *new_terminal_int(int value, int line) {
  ASTNode *node = new_terminal("INT", line);

  node->value_kind = AST_VALUE_INT;
  node->int_val = value;
  return node;
}

ASTNode *new_terminal_float(float value, int line) {
  ASTNode *node = new_terminal("FLOAT", line);

  node->value_kind = AST_VALUE_FLOAT;
  node->float_val = value;
  return node;
}

void add_child(ASTNode *parent, ASTNode *child) {
  ASTNode **new_children;

  if (parent == NULL || child == NULL) {
    return;
  }

  if (parent->child_count == parent->child_capacity) {
    parent->child_capacity =
        parent->child_capacity == 0
            ? 4                           // Initial capacity of 4
            : parent->child_capacity * 2; // Double the size later
    new_children = (ASTNode **)realloc(
        parent->children, (size_t)parent->child_capacity * sizeof(ASTNode *));
    if (new_children == NULL) {
      fprintf(stderr, "Out of memory\n");
      exit(1);
    }
    parent->children = new_children;
  }

  parent->children[parent->child_count++] = child;
}

void print_ast(const ASTNode *root, int indent) {
  int i;

  if (root == NULL) {
    return;
  }

  for (i = 0; i < indent; ++i) {
    printf("  ");
  }

  printf("%s", root->name);
  if (root->type == NODE_TERMINAL) {
    switch (root->value_kind) {
    case AST_VALUE_ID:
    case AST_VALUE_TYPE:
      printf(": %s", root->text);
      break;
    case AST_VALUE_INT:
      printf(": %d", root->int_val);
      break;
    case AST_VALUE_FLOAT:
      printf(": %f", root->float_val);
      break;
    case AST_VALUE_NONE:
    default:
      break;
    }
  } else {
    if (root->line > 0) {
      printf(" (%d)", root->line);
    }
  }
  printf("\n");

  for (i = 0; i < root->child_count; ++i) {
    print_ast(root->children[i], indent + 1);
  }
}

void free_ast(ASTNode *root) {
  int i;

  if (root == NULL) {
    return;
  }

  for (i = 0; i < root->child_count; ++i) {
    free_ast(root->children[i]);
  }

  free(root->children);
  free(root->name);
  free(root->text);
  free(root);
}
